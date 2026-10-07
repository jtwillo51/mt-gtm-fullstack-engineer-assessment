import {
  type ActionResult,
  type ListOptions,
  type PaginatedResult,
  type ServiceContext,
  clampLimit,
  getClient,
  getErrorMessage,
  getUserId,
  isUuid,
} from './base'
import { applySearch } from './search'
import { campaignListConfig } from '@/lib/config/models/campaign-config'
import type { CampaignFormInput, CampaignUpdateInput } from '@/lib/schemas'
import type { Role } from '@/lib/auth'

export interface Campaign {
  id: string
  name: string
  type: string
  status: string
  audience: string
  occasion: string | null
  purpose: string | null
  target_industries: string[]
  start_date: string | null
  end_date: string | null
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
  // view-derived stats (cumulative funnel over live members)
  member_count?: number
  sent_count?: number
  bounced_count?: number
  opened_count?: number
  responded_count?: number
  converted_count?: number
}

export interface CampaignStats {
  members: number
  sent: number
  delivered: number
  opened: number
  responded: number
  converted: number
  /** opened / delivered, or null when nothing was delivered. */
  openRate: number | null
  /** responded / delivered */
  responseRate: number | null
  /** converted / sent — the campaign's success rate. */
  successRate: number | null
}

/** Turn the view's raw counts into rates. Pure — safe to unit test. */
export function computeCampaignStats(c: Campaign): CampaignStats {
  const members = c.member_count ?? 0
  const sent = c.sent_count ?? 0
  const delivered = sent - (c.bounced_count ?? 0)
  const opened = c.opened_count ?? 0
  const responded = c.responded_count ?? 0
  const converted = c.converted_count ?? 0
  const rate = (n: number, d: number) => (d > 0 ? n / d : null)
  return {
    members,
    sent,
    delivered,
    opened,
    responded,
    converted,
    openRate: rate(opened, delivered),
    responseRate: rate(responded, delivered),
    successRate: rate(converted, sent),
  }
}

/**
 * Can this user change the campaign (fields, members, artifacts, delete)?
 * Mirrors RLS: admins can change anything; an editor only campaigns they own
 * (0006 extends that to members/artifacts others added to their campaign).
 * The UI uses it to hide controls that would only fail with "Permission denied".
 */
export function canManageCampaign(
  user: { id: string; role: Role },
  campaign: Pick<Campaign, 'owner_id'>
): boolean {
  if (user.role === 'Admin') return true
  return user.role === 'Editor' && campaign.owner_id === user.id
}

/** Each member counted once, at the furthest stage they reached. */
export interface CampaignOutcomeBreakdown {
  converted: number
  responded: number
  opened: number
  sent: number // sent (and delivered) but went no further
  bounced: number
  notSent: number // still Targeted
}

/** Un-accumulate the view's cumulative funnel counts. Pure — safe to unit test. */
export function computeOutcomeBreakdown(c: Campaign): CampaignOutcomeBreakdown {
  const members = c.member_count ?? 0
  const sent = c.sent_count ?? 0
  const bounced = c.bounced_count ?? 0
  const opened = c.opened_count ?? 0
  const responded = c.responded_count ?? 0
  const converted = c.converted_count ?? 0
  return {
    converted,
    responded: responded - converted,
    opened: opened - responded,
    sent: sent - bounced - opened,
    bounced,
    notSent: members - sent,
  }
}

export async function getCampaign(id: string, ctx?: ServiceContext): Promise<Campaign | null> {
  if (!isUuid(id)) return null
  const client = await getClient(ctx)
  const { data, error } = await client
    .from('v_campaigns')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return (data as Campaign | null) ?? null
}

export async function listCampaigns(
  options: ListOptions = {},
  ctx?: ServiceContext
): Promise<PaginatedResult<Campaign>> {
  const client = await getClient(ctx)
  const limit = clampLimit(options.limit)
  const offset = options.offset ?? 0

  let query = client.from('v_campaigns').select('*', { count: 'exact' }).is('deleted_at', null)

  query = applySearch(query, campaignListConfig.searchFields ?? [], options.search)

  // Newest campaigns first by default; undated drafts sink to the bottom.
  query = query
    .order(options.orderBy ?? 'start_date', {
      ascending: options.orderAsc ?? false,
      nullsFirst: false,
    })
    .order('name', { ascending: true })
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1)

  const { data, error, count } = await query
  if (error) throw error

  return {
    data: (data as Campaign[]) ?? [],
    pagination: { total: count ?? 0, limit, offset },
  }
}

export async function createCampaign(
  input: CampaignFormInput,
  ctx?: ServiceContext
): Promise<ActionResult<Campaign>> {
  try {
    const client = await getClient(ctx)
    const userId = await getUserId(ctx)
    const { data, error } = await client
      .from('campaigns')
      .insert({ ...input, created_by: userId, updated_by: userId })
      .select()
      .single()
    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Campaign }
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to create campaign') }
  }
}

export async function updateCampaign(
  id: string,
  input: CampaignUpdateInput,
  ctx?: ServiceContext
): Promise<ActionResult<Campaign>> {
  try {
    const client = await getClient(ctx)
    const userId = await getUserId(ctx)
    const { data, error } = await client
      .from('campaigns')
      .update({ ...input, updated_by: userId })
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single()
    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Campaign }
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to update campaign') }
  }
}

export async function deleteCampaign(
  id: string,
  ctx?: ServiceContext
): Promise<ActionResult<void>> {
  try {
    const client = await getClient(ctx)
    const userId = await getUserId(ctx)
    // Soft delete, confirmed via .select() (needs the editor/admin SELECT bypass).
    const { data, error } = await client
      .from('campaigns')
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq('id', id)
      .select()
    if (error) return { success: false, error: error.message }
    if (!data || data.length === 0) {
      return { success: false, error: 'Permission denied or campaign not found' }
    }
    return { success: true, data: undefined }
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to delete campaign') }
  }
}
