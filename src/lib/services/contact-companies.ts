import {
  type ActionResult,
  type PaginatedResult,
  type ServiceContext,
  getClient,
  getErrorMessage,
  getUserId,
} from './base'
import { createContact, type Contact } from './contacts'
import type { ContactFormInput } from '@/lib/schemas'

/** A contact's membership in a company. */
export interface ContactCompany {
  id: string
  contact_id: string
  company_id: string
  is_primary: boolean
  company_name?: string | null
}

/** A row shaped for the "contacts in this company" child table. */
export interface CompanyContactRow {
  id: string // contact id (so the row links to /contacts/:id)
  first_name: string
  last_name: string | null
  email: string | null
  title: string | null
  primary: string | null // 'Primary' badge, or null
}

/** Memberships for a contact (company detail → Companies manager). */
export async function listContactCompanies(
  contactId: string,
  ctx?: ServiceContext
): Promise<ContactCompany[]> {
  const client = await getClient(ctx)
  const { data, error } = await client
    .from('v_contact_companies')
    .select('id, contact_id, company_id, is_primary, company_name')
    .eq('contact_id', contactId)
    .is('deleted_at', null)
    .order('is_primary', { ascending: false })
    .order('company_name', { ascending: true })
  if (error) throw error
  return (data as ContactCompany[]) ?? []
}

/** Contacts that belong to a company (company detail → Contacts child table). */
export async function listContactsForCompany(
  companyId: string,
  ctx?: ServiceContext
): Promise<PaginatedResult<CompanyContactRow>> {
  const client = await getClient(ctx)
  const { data, error, count } = await client
    .from('v_contact_companies')
    .select(
      'contact_id, is_primary, contact_first_name, contact_last_name, contact_email, contact_title',
      { count: 'exact' }
    )
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .order('is_primary', { ascending: false })
    .order('contact_first_name', { ascending: true })
  if (error) throw error

  const rows: CompanyContactRow[] = ((data as Record<string, unknown>[]) ?? []).map((r) => ({
    id: r.contact_id as string,
    first_name: r.contact_first_name as string,
    last_name: (r.contact_last_name as string | null) ?? null,
    email: (r.contact_email as string | null) ?? null,
    title: (r.contact_title as string | null) ?? null,
    primary: r.is_primary ? 'Primary' : null,
  }))

  return { data: rows, pagination: { total: count ?? rows.length, limit: 100, offset: 0 } }
}

/** Attach a contact to a company. Idempotent per (contact, company); resurrects a
 *  previously-removed membership. The DB trigger makes the first membership primary. */
export async function attachContactToCompany(
  contactId: string,
  companyId: string,
  ctx?: ServiceContext,
  opts: { isPrimary?: boolean } = {}
): Promise<ActionResult<ContactCompany>> {
  try {
    const client = await getClient(ctx)
    const userId = await getUserId(ctx)

    // Look up any existing membership (incl. soft-deleted) for this pair.
    const { data: existing } = await client
      .from('contact_companies')
      .select('id, deleted_at')
      .eq('contact_id', contactId)
      .eq('company_id', companyId)
      .maybeSingle()

    if (existing) {
      const payload: Record<string, unknown> = { updated_by: userId }
      if (existing.deleted_at) {
        payload.deleted_at = null
        payload.deleted_by = null
      }
      if (opts.isPrimary) payload.is_primary = true
      const { data, error } = await client
        .from('contact_companies')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single()
      if (error) return { success: false, error: error.message }
      return { success: true, data: data as ContactCompany }
    }

    const { data, error } = await client
      .from('contact_companies')
      .insert({
        contact_id: contactId,
        company_id: companyId,
        is_primary: opts.isPrimary ?? false,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single()
    if (error) return { success: false, error: error.message }
    return { success: true, data: data as ContactCompany }
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to attach contact to company') }
  }
}

/** Create a new contact and attach it to a company (the "Add Contact" flow). */
export async function createContactForCompany(
  companyId: string,
  input: ContactFormInput,
  ctx?: ServiceContext
): Promise<ActionResult<Contact>> {
  const created = await createContact(input, ctx)
  if (!created.success) return created
  const attached = await attachContactToCompany(created.data.id, companyId, ctx)
  if (!attached.success) return { success: false, error: attached.error }
  return created
}

export async function setPrimaryContactCompany(
  membershipId: string,
  ctx?: ServiceContext
): Promise<ActionResult<void>> {
  try {
    const client = await getClient(ctx)
    const userId = await getUserId(ctx)
    // The DB trigger demotes the contact's other primaries.
    const { data, error } = await client
      .from('contact_companies')
      .update({ is_primary: true, updated_by: userId })
      .eq('id', membershipId)
      .is('deleted_at', null)
      .select()
    if (error) return { success: false, error: error.message }
    if (!data || data.length === 0) return { success: false, error: 'Membership not found' }
    return { success: true, data: undefined }
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to set primary company') }
  }
}

export async function removeContactCompany(
  membershipId: string,
  ctx?: ServiceContext
): Promise<ActionResult<void>> {
  try {
    const client = await getClient(ctx)
    const userId = await getUserId(ctx)

    const { data, error } = await client
      .from('contact_companies')
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq('id', membershipId)
      .select('contact_id, is_primary')
    if (error) return { success: false, error: error.message }
    if (!data || data.length === 0) {
      return { success: false, error: 'Permission denied or membership not found' }
    }

    // If we removed the primary, promote another live membership (if any).
    const removed = data[0] as { contact_id: string; is_primary: boolean }
    if (removed.is_primary) {
      const { data: next } = await client
        .from('contact_companies')
        .select('id')
        .eq('contact_id', removed.contact_id)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (next?.id) await setPrimaryContactCompany(next.id as string, ctx)
    }

    return { success: true, data: undefined }
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to remove membership') }
  }
}
