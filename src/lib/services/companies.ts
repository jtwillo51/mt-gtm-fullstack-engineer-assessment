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
import { applySearch } from './search'
import { companyListConfig } from '@/lib/config/models/company-config'
import type { CompanyFormInput, CompanyUpdateInput } from '@/lib/schemas'

export interface Company {
  id: string
  name: string
  website: string | null
  industry: string | null
  owner_id: string | null
  created_at: string
  created_by: string | null
  updated_at: string
  updated_by: string | null
  deleted_at: string | null
  deleted_by: string | null
  // view-joined
  owner_name?: string | null
  created_by_name?: string | null
  updated_by_name?: string | null
}

export async function getCompany(id: string, ctx?: ServiceContext): Promise<Company | null> {
  const client = await getClient(ctx)
  const { data, error } = await client
    .from('v_companies')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return (data as Company | null) ?? null
}

export async function listCompanies(
  options: ListOptions = {},
  ctx?: ServiceContext
): Promise<PaginatedResult<Company>> {
  const client = await getClient(ctx)
  const limit = clampLimit(options.limit)
  const offset = options.offset ?? 0

  let query = client.from('v_companies').select('*', { count: 'exact' }).is('deleted_at', null)

  query = applySearch(query, companyListConfig.searchFields ?? [], options.search)

  query = query
    .order(options.orderBy ?? 'name', { ascending: options.orderAsc ?? true })
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1)

  const { data, error, count } = await query
  if (error) throw error

  return {
    data: (data as Company[]) ?? [],
    pagination: { total: count ?? 0, limit, offset },
  }
}

export async function createCompany(
  input: CompanyFormInput,
  ctx?: ServiceContext
): Promise<ActionResult<Company>> {
  try {
    const client = await getClient(ctx)
    const userId = await getUserId(ctx)
    const { data, error } = await client
      .from('companies')
      .insert({ ...input, created_by: userId, updated_by: userId })
      .select()
      .single()
    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Company }
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to create company') }
  }
}

export async function updateCompany(
  id: string,
  input: CompanyUpdateInput,
  ctx?: ServiceContext
): Promise<ActionResult<Company>> {
  try {
    const client = await getClient(ctx)
    const userId = await getUserId(ctx)
    const { data, error } = await client
      .from('companies')
      .update({ ...input, updated_by: userId })
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single()
    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Company }
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to update company') }
  }
}

export async function deleteCompany(id: string, ctx?: ServiceContext): Promise<ActionResult<void>> {
  try {
    const client = await getClient(ctx)
    const userId = await getUserId(ctx)
    // Soft delete, confirmed via .select() (needs the editor/admin SELECT bypass).
    const { data, error } = await client
      .from('companies')
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq('id', id)
      .select()
    if (error) return { success: false, error: error.message }
    if (!data || data.length === 0) {
      return { success: false, error: 'Permission denied or company not found' }
    }
    return { success: true, data: undefined }
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to delete company') }
  }
}
