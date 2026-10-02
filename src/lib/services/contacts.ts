import {
  type ActionResult,
  type ListOptions,
  type PaginatedResult,
  type ServiceContext,
  clampLimit,
  getClient,
  getErrorMessage,
  getUserId,
} from './base'
import type { ContactFormInput, ContactUpdateInput } from '@/lib/schemas'

export interface Contact {
  id: string
  first_name: string
  last_name: string | null
  email: string | null
  title: string | null
  owner_id: string | null
  created_at: string
  created_by: string | null
  updated_at: string
  updated_by: string | null
  deleted_at: string | null
  deleted_by: string | null
  // view-joined
  primary_company_id?: string | null
  primary_company_name?: string | null
  owner_name?: string | null
  created_by_name?: string | null
  updated_by_name?: string | null
}

export async function getContact(id: string, ctx?: ServiceContext): Promise<Contact | null> {
  const client = await getClient(ctx)
  const { data, error } = await client
    .from('v_contacts')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return (data as Contact | null) ?? null
}

export async function listContacts(
  options: ListOptions = {},
  ctx?: ServiceContext
): Promise<PaginatedResult<Contact>> {
  const client = await getClient(ctx)
  const limit = clampLimit(options.limit)
  const offset = options.offset ?? 0

  let query = client.from('v_contacts').select('*', { count: 'exact' }).is('deleted_at', null)

  if (options.search) {
    query = query.or(`first_name.ilike.%${options.search}%,last_name.ilike.%${options.search}%`)
  }

  query = query
    .order(options.orderBy ?? 'first_name', { ascending: options.orderAsc ?? true })
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1)

  const { data, error, count } = await query
  if (error) throw error

  return {
    data: (data as Contact[]) ?? [],
    pagination: { total: count ?? 0, limit, offset },
  }
}

export async function createContact(
  input: ContactFormInput,
  ctx?: ServiceContext
): Promise<ActionResult<Contact>> {
  try {
    const client = await getClient(ctx)
    const userId = await getUserId(ctx)
    const { data, error } = await client
      .from('contacts')
      .insert({ ...input, created_by: userId, updated_by: userId })
      .select()
      .single()
    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Contact }
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to create contact') }
  }
}

export async function updateContact(
  id: string,
  input: ContactUpdateInput,
  ctx?: ServiceContext
): Promise<ActionResult<Contact>> {
  try {
    const client = await getClient(ctx)
    const userId = await getUserId(ctx)
    const { data, error } = await client
      .from('contacts')
      .update({ ...input, updated_by: userId })
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single()
    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Contact }
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to update contact') }
  }
}

export async function deleteContact(id: string, ctx?: ServiceContext): Promise<ActionResult<void>> {
  try {
    const client = await getClient(ctx)
    const userId = await getUserId(ctx)
    const { data, error } = await client
      .from('contacts')
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq('id', id)
      .select()
    if (error) return { success: false, error: error.message }
    if (!data || data.length === 0) {
      return { success: false, error: 'Permission denied or contact not found' }
    }
    return { success: true, data: undefined }
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to delete contact') }
  }
}
