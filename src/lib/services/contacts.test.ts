import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createContact, deleteContact, getContact, listContacts, updateContact } from './contacts'
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

describe('contacts service', () => {
  it('an editor can create a standalone contact', async () => {
    const result = await createContact({ first_name: 'Nancy', last_name: 'Davolio' }, editorCtx)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.first_name).toBe('Nancy')
  })

  it('a viewer is blocked by RLS from creating', async () => {
    const result = await createContact({ first_name: 'Nope' }, viewerCtx)
    expect(result.success).toBe(false)
  })

  it('get returns a created contact and null for a missing id', async () => {
    const created = await createContact({ first_name: 'Readable' }, editorCtx)
    expect(created.success).toBe(true)
    if (!created.success) return
    const found = await getContact(created.data.id, editorCtx)
    expect(found?.first_name).toBe('Readable')
    expect(await getContact('00000000-0000-0000-0000-000000000000', editorCtx)).toBeNull()
  })

  it('a contact with no membership has no primary company', async () => {
    const created = await createContact({ first_name: 'Unlinked' }, editorCtx)
    if (!created.success) return
    const found = await getContact(created.data.id, editorCtx)
    expect(found?.primary_company_name ?? null).toBeNull()
  })

  it('list returns contacts and supports search', async () => {
    await createContact({ first_name: 'Zelda', last_name: 'Searchable' }, editorCtx)
    const result = await listContacts({ search: 'Zelda' }, editorCtx)
    expect(result.data.some((c) => c.first_name === 'Zelda')).toBe(true)
  })

  it('update changes fields', async () => {
    const created = await createContact({ first_name: 'Before' }, editorCtx)
    if (!created.success) return
    const updated = await updateContact(created.data.id, { title: 'Owner' }, editorCtx)
    expect(updated.success).toBe(true)
    if (!updated.success) return
    expect(updated.data.title).toBe('Owner')
  })

  it('an editor can soft-delete and the call reports success', async () => {
    const created = await createContact({ first_name: 'Gone' }, editorCtx)
    if (!created.success) return
    const deleted = await deleteContact(created.data.id, editorCtx)
    expect(deleted.success).toBe(true)
    expect(await getContact(created.data.id, editorCtx)).toBeNull()
  })
})
