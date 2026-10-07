import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  createCampaign,
  deleteCampaign,
  getCampaign,
  listCampaigns,
  updateCampaign,
} from './campaigns'
import {
  createIsolatedTestUsers,
  createTestUserContext,
  deleteTestUser,
  getAdminClientForTests,
  type TestUser,
} from '@/__tests__/utils/rls-helpers'
import { cleanupTestDataByOwner } from '@/__tests__/utils/seed-helpers'
import type { ServiceContext } from './base'

let admin: TestUser, editor: TestUser, viewer: TestUser
let editorCtx: ServiceContext, viewerCtx: ServiceContext

beforeAll(async () => {
  const users = await createIsolatedTestUsers()
  admin = users.admin
  editor = users.editor
  viewer = users.viewer
  editorCtx = await createTestUserContext(editor)
  viewerCtx = await createTestUserContext(viewer)
})

afterEach(async () => {
  await Promise.all([
    cleanupTestDataByOwner(admin.id),
    cleanupTestDataByOwner(editor.id),
    cleanupTestDataByOwner(viewer.id),
  ])
})

afterAll(async () => {
  await Promise.all([
    deleteTestUser(admin.authId, admin.id),
    deleteTestUser(editor.authId, editor.id),
    deleteTestUser(viewer.authId, viewer.id),
  ])
})

const base = { type: 'Email' as const, audience: 'External' as const }

describe('campaigns service', () => {
  it('an editor can create a campaign and audit fields are stamped', async () => {
    const result = await createCampaign(
      {
        ...base,
        name: 'July Promo',
        occasion: '4th of July Sale',
        target_industries: ['Salon', 'Barbershop'],
      },
      editorCtx
    )
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.status).toBe('Draft') // DB default
    expect(result.data.target_industries).toEqual(['Salon', 'Barbershop'])

    const { data } = await getAdminClientForTests()
      .from('campaigns')
      .select('owner_id, created_by, updated_by')
      .eq('id', result.data.id)
      .single()
    expect(data?.created_by).toBe(editor.id)
    expect(data?.updated_by).toBe(editor.id)
    expect(data?.owner_id).toBe(editor.id)
  })

  it('a viewer is blocked by RLS from creating', async () => {
    const result = await createCampaign({ ...base, name: 'Nope' }, viewerCtx)
    expect(result.success).toBe(false)
  })

  it('the DB rejects an end date before the start date and an unknown type', async () => {
    const badDates = await createCampaign(
      { ...base, name: 'Backwards', start_date: '2026-07-10', end_date: '2026-07-01' },
      editorCtx
    )
    expect(badDates.success).toBe(false)

    const badType = await createCampaign(
      { ...base, name: 'Carrier pigeon', type: 'Pigeon' as never },
      editorCtx
    )
    expect(badType.success).toBe(false)

    const badIndustry = await createCampaign(
      { ...base, name: 'Off list', target_industries: ['Fitness'] as never },
      editorCtx
    )
    expect(badIndustry.success).toBe(false)
  })

  it('get returns a campaign with zeroed stats, and null for a missing id', async () => {
    const created = await createCampaign({ ...base, name: 'Readable' }, editorCtx)
    expect(created.success).toBe(true)
    if (!created.success) return

    const found = await getCampaign(created.data.id, editorCtx)
    expect(found?.name).toBe('Readable')
    expect(found?.member_count).toBe(0)
    expect(found?.converted_count).toBe(0)

    const missing = await getCampaign('00000000-0000-0000-0000-000000000000', editorCtx)
    expect(missing).toBeNull()
    // A malformed id from the URL is a 404, not a Postgres uuid parse error.
    expect(await getCampaign('not-a-uuid', editorCtx)).toBeNull()
  })

  it('list searches by name and by occasion', async () => {
    await createCampaign(
      { ...base, name: 'Zeta Searchable Campaign', occasion: 'Quokka Day' },
      editorCtx
    )
    const byName = await listCampaigns({ search: 'Zeta Searchable' }, editorCtx)
    expect(byName.data.some((c) => c.name === 'Zeta Searchable Campaign')).toBe(true)

    const byOccasion = await listCampaigns({ search: 'Quokka' }, editorCtx)
    expect(byOccasion.data.some((c) => c.name === 'Zeta Searchable Campaign')).toBe(true)
  })

  it('update changes only the given fields', async () => {
    const created = await createCampaign(
      { ...base, name: 'Before', status: 'Active', target_industries: ['Spa'] },
      editorCtx
    )
    expect(created.success).toBe(true)
    if (!created.success) return

    const updated = await updateCampaign(created.data.id, { name: 'After' }, editorCtx)
    expect(updated.success).toBe(true)
    if (!updated.success) return
    expect(updated.data.name).toBe('After')
    expect(updated.data.status).toBe('Active')
    expect(updated.data.target_industries).toEqual(['Spa'])
  })

  it('an editor can soft-delete and the campaign disappears from reads', async () => {
    const created = await createCampaign({ ...base, name: 'To Delete' }, editorCtx)
    expect(created.success).toBe(true)
    if (!created.success) return

    const deleted = await deleteCampaign(created.data.id, editorCtx)
    expect(deleted.success).toBe(true)
    expect(await getCampaign(created.data.id, editorCtx)).toBeNull()
  })
})
