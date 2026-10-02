import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  attachContactToCompany,
  listContactCompanies,
  listContactsForCompany,
  setPrimaryContactCompany,
  removeContactCompany,
} from './contact-companies'
import { createCompany } from './companies'
import { createContact, getContact } from './contacts'
import {
  createIsolatedTestUsers,
  createTestUserContext,
  deleteTestUser,
  type TestUser,
} from '@/__tests__/utils/rls-helpers'
import { cleanupTestDataByOwner } from '@/__tests__/utils/seed-helpers'
import type { ServiceContext } from './base'

let admin: TestUser, editor: TestUser, viewer: TestUser
let editorCtx: ServiceContext, viewerCtx: ServiceContext

async function company(): Promise<string> {
  const r = await createCompany({ name: `Co ${Math.random()}` }, editorCtx)
  if (!r.success) throw new Error(r.error)
  return r.data.id
}
async function contact(): Promise<string> {
  const r = await createContact(
    { first_name: `P${Math.random().toString(36).slice(2, 6)}` },
    editorCtx
  )
  if (!r.success) throw new Error(r.error)
  return r.data.id
}

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

describe('contact_companies (many-to-many with a primary)', () => {
  it('the first company a contact is attached to becomes its primary', async () => {
    const c = await contact()
    const co = await company()
    const r = await attachContactToCompany(c, co, editorCtx)
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.is_primary).toBe(true)

    const found = await getContact(c, editorCtx)
    expect(found?.primary_company_id).toBe(co)
    expect(found?.primary_company_name).toBeTruthy()
  })

  it('a contact can belong to multiple companies with exactly one primary', async () => {
    const c = await contact()
    const a = await company()
    const b = await company()
    await attachContactToCompany(c, a, editorCtx)
    await attachContactToCompany(c, b, editorCtx)

    const memberships = await listContactCompanies(c, editorCtx)
    expect(memberships).toHaveLength(2)
    expect(memberships.filter((m) => m.is_primary)).toHaveLength(1)
  })

  it('attaching the same company twice is idempotent (no duplicate membership)', async () => {
    const c = await contact()
    const co = await company()
    await attachContactToCompany(c, co, editorCtx)
    await attachContactToCompany(c, co, editorCtx)
    const memberships = await listContactCompanies(c, editorCtx)
    expect(memberships).toHaveLength(1)
  })

  it('setting a new primary demotes the previous one', async () => {
    const c = await contact()
    const a = await company()
    const b = await company()
    await attachContactToCompany(c, a, editorCtx) // primary
    const second = await attachContactToCompany(c, b, editorCtx)
    if (!second.success) return

    const promote = await setPrimaryContactCompany(second.data.id, editorCtx)
    expect(promote.success).toBe(true)

    const memberships = await listContactCompanies(c, editorCtx)
    const primaries = memberships.filter((m) => m.is_primary)
    expect(primaries).toHaveLength(1)
    expect(primaries[0].company_id).toBe(b)
  })

  it('listContactsForCompany returns the company’s contacts with the primary flag', async () => {
    const c = await contact()
    const co = await company()
    await attachContactToCompany(c, co, editorCtx)
    const result = await listContactsForCompany(co, editorCtx)
    expect(result.data.some((row) => row.id === c && row.primary === 'Primary')).toBe(true)
  })

  it('removing the primary membership promotes another', async () => {
    const c = await contact()
    const a = await company()
    const b = await company()
    const first = await attachContactToCompany(c, a, editorCtx) // primary
    await attachContactToCompany(c, b, editorCtx)
    if (!first.success) return

    const removed = await removeContactCompany(first.data.id, editorCtx)
    expect(removed.success).toBe(true)

    const memberships = await listContactCompanies(c, editorCtx)
    expect(memberships).toHaveLength(1)
    expect(memberships[0].is_primary).toBe(true)
    expect(memberships[0].company_id).toBe(b)
  })

  it('a viewer is blocked by RLS from attaching', async () => {
    const c = await contact()
    const co = await company()
    const r = await attachContactToCompany(c, co, viewerCtx)
    expect(r.success).toBe(false)
  })
})
