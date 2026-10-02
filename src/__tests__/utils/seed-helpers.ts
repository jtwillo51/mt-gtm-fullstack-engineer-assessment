import { getAdminClientForTests } from './rls-helpers'

/**
 * Seed factories + owner-scoped cleanup. Writes go through the admin client, so
 * audit FKs are set explicitly.
 *
 * ⚠️ When you add a new FK-child table (e.g. a campaign-membership join), add it
 * to an EARLY batch in cleanupTestDataByOwner — before its FK parents — or
 * cleanup fails with a foreign key violation.
 */

export async function createTestCompany(
  ownerId: string,
  overrides: Record<string, unknown> = {}
): Promise<{ id: string; name: string }> {
  const admin = getAdminClientForTests()
  const { data, error } = await admin
    .from('companies')
    .insert({
      name: `Test Co ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      owner_id: ownerId,
      created_by: ownerId,
      updated_by: ownerId,
      ...overrides,
    })
    .select()
    .single()
  if (error) throw error
  return data as { id: string; name: string }
}

/** A standalone contact (no company — attach via contact_companies). */
export async function createTestContact(
  ownerId: string,
  overrides: Record<string, unknown> = {}
): Promise<{ id: string; first_name: string }> {
  const admin = getAdminClientForTests()
  const { data, error } = await admin
    .from('contacts')
    .insert({
      first_name: `Test${Math.random().toString(36).slice(2, 6)}`,
      owner_id: ownerId,
      created_by: ownerId,
      updated_by: ownerId,
      ...overrides,
    })
    .select()
    .single()
  if (error) throw error
  return data as { id: string; first_name: string }
}

export async function createTestContactCompany(
  contactId: string,
  companyId: string,
  ownerId: string,
  overrides: Record<string, unknown> = {}
): Promise<{ id: string; is_primary: boolean }> {
  const admin = getAdminClientForTests()
  const { data, error } = await admin
    .from('contact_companies')
    .insert({
      contact_id: contactId,
      company_id: companyId,
      owner_id: ownerId,
      created_by: ownerId,
      updated_by: ownerId,
      ...overrides,
    })
    .select()
    .single()
  if (error) throw error
  return data as { id: string; is_primary: boolean }
}

/** Hard-delete all rows owned by a test user, children (join) first. */
export async function cleanupTestDataByOwner(ownerId: string): Promise<void> {
  const admin = getAdminClientForTests()
  await admin.from('contact_companies').delete().eq('owner_id', ownerId)
  await admin.from('contacts').delete().eq('owner_id', ownerId)
  await admin.from('companies').delete().eq('owner_id', ownerId)
}
