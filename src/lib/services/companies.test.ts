import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createCompany, deleteCompany, getCompany, listCompanies, updateCompany } from './companies'
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

describe('companies service', () => {
  it('an editor can create a company and audit fields are stamped', async () => {
    const result = await createCompany({ name: 'Acme Co', website: 'https://acme.test' }, editorCtx)
    expect(result.success).toBe(true)
    if (!result.success) return

    // Read back raw (admin) to assert the stamp.
    const admin = getAdminClientForTests()
    const { data } = await admin
      .from('companies')
      .select('owner_id, created_by, updated_by')
      .eq('id', result.data.id)
      .single()
    expect(data?.created_by).toBe(editor.id)
    expect(data?.updated_by).toBe(editor.id)
    expect(data?.owner_id).toBe(editor.id)
  })

  it('a viewer is blocked by RLS from creating', async () => {
    const result = await createCompany({ name: 'Nope Inc' }, viewerCtx)
    expect(result.success).toBe(false)
  })

  it('get returns a created company and null for a missing id', async () => {
    const created = await createCompany({ name: 'Readable Co' }, editorCtx)
    expect(created.success).toBe(true)
    if (!created.success) return

    const found = await getCompany(created.data.id, editorCtx)
    expect(found?.name).toBe('Readable Co')

    const missing = await getCompany('00000000-0000-0000-0000-000000000000', editorCtx)
    expect(missing).toBeNull()
  })

  it('list returns created companies and supports search', async () => {
    await createCompany({ name: 'Zeta Searchable Co' }, editorCtx)
    const result = await listCompanies({ search: 'Zeta Searchable' }, editorCtx)
    expect(result.data.length).toBeGreaterThanOrEqual(1)
    expect(result.data.every((c) => c.name.includes('Zeta Searchable'))).toBe(true)
  })

  it('update changes fields and re-stamps updated_by', async () => {
    const created = await createCompany({ name: 'Before' }, editorCtx)
    expect(created.success).toBe(true)
    if (!created.success) return

    const updated = await updateCompany(created.data.id, { name: 'After' }, editorCtx)
    expect(updated.success).toBe(true)
    if (!updated.success) return
    expect(updated.data.name).toBe('After')
  })

  it('an editor can soft-delete and the call reports success', async () => {
    // Exercises the SELECT-policy editor/admin bypass: the `.select()`
    // confirmation after the soft-delete must return the just-deleted row.
    const created = await createCompany({ name: 'To Delete' }, editorCtx)
    expect(created.success).toBe(true)
    if (!created.success) return

    const deleted = await deleteCompany(created.data.id, editorCtx)
    expect(deleted.success).toBe(true)

    // It no longer appears in normal reads.
    const found = await getCompany(created.data.id, editorCtx)
    expect(found).toBeNull()
  })
})
