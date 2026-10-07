import {
  type ActionResult,
  type PaginatedResult,
  type ServiceContext,
  getClient,
  getErrorMessage,
  getUserId,
} from './base'
import type { CampaignMemberStatus } from '@/lib/schemas'
import { escapeLike, quotePostgrestValue } from './search'

/** A row shaped for the campaign detail → Members table. */
export interface CampaignMemberRow {
  id: string // membership id
  kind: 'company' | 'contact'
  company_id: string | null
  contact_id: string | null
  /** Person's full name, or the company name for a company-level member. */
  name: string
  company_name: string | null
  company_industry: string | null
  email: string | null
  title: string | null
  status: CampaignMemberStatus
}

/** Members of a campaign — people first, then companies, alphabetical. */
export async function listCampaignMembers(
  campaignId: string,
  ctx?: ServiceContext
): Promise<PaginatedResult<CampaignMemberRow>> {
  const client = await getClient(ctx)
  const { data, error, count } = await client
    .from('v_campaign_members')
    .select(
      'id, company_id, contact_id, status, company_name, company_industry, contact_first_name, contact_last_name, contact_email, contact_title',
      { count: 'exact' }
    )
    .eq('campaign_id', campaignId)
    .is('deleted_at', null)
  if (error) throw error

  const rows: CampaignMemberRow[] = ((data as Record<string, unknown>[]) ?? []).map((r) => {
    const isContact = r.contact_id != null
    const personName = [r.contact_first_name, r.contact_last_name].filter(Boolean).join(' ')
    return {
      id: r.id as string,
      kind: isContact ? 'contact' : 'company',
      company_id: (r.company_id as string | null) ?? null,
      contact_id: (r.contact_id as string | null) ?? null,
      name: isContact ? personName : ((r.company_name as string | null) ?? 'Company'),
      company_name: (r.company_name as string | null) ?? null,
      company_industry: (r.company_industry as string | null) ?? null,
      email: (r.contact_email as string | null) ?? null,
      title: (r.contact_title as string | null) ?? null,
      status: r.status as CampaignMemberStatus,
    }
  })
  rows.sort((a, b) =>
    a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'contact' ? -1 : 1
  )

  return { data: rows, pagination: { total: count ?? rows.length, limit: rows.length, offset: 0 } }
}

/**
 * Upsert one live membership. Idempotent: an existing live member is returned
 * unchanged; a previously-removed one is resurrected (status reset to Targeted).
 */
async function upsertMember(
  campaignId: string,
  target: { companyId: string | null; contactId: string | null },
  ctx?: ServiceContext
): Promise<ActionResult<{ id: string }>> {
  try {
    const client = await getClient(ctx)
    const userId = await getUserId(ctx)

    let lookup = client
      .from('campaign_members')
      .select('id, deleted_at')
      .eq('campaign_id', campaignId)
      .order('deleted_at', { ascending: false, nullsFirst: true })
      .limit(1)
    lookup = target.contactId
      ? lookup.eq('contact_id', target.contactId)
      : lookup.eq('company_id', target.companyId!).is('contact_id', null)
    const { data: existing, error: lookupError } = await lookup.maybeSingle()
    if (lookupError) return { success: false, error: lookupError.message }

    if (existing && !existing.deleted_at) return { success: true, data: { id: existing.id } }

    if (existing) {
      const { data, error } = await client
        .from('campaign_members')
        .update({
          deleted_at: null,
          deleted_by: null,
          status: 'Targeted',
          company_id: target.companyId,
          updated_by: userId,
        })
        .eq('id', existing.id)
        .select('id')
        .single()
      if (error) return { success: false, error: error.message }
      return { success: true, data: { id: data.id as string } }
    }

    const { data, error } = await client
      .from('campaign_members')
      .insert({
        campaign_id: campaignId,
        company_id: target.companyId,
        contact_id: target.contactId,
        created_by: userId,
        updated_by: userId,
      })
      .select('id')
      .single()
    if (error) return { success: false, error: error.message }
    return { success: true, data: { id: data.id as string } }
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to add campaign member') }
  }
}

/** Add a company (company-level membership). */
export async function addCompanyToCampaign(
  campaignId: string,
  companyId: string,
  ctx?: ServiceContext
): Promise<ActionResult<{ id: string }>> {
  return upsertMember(campaignId, { companyId, contactId: null }, ctx)
}

/** Add a person. Records the company they were reached through — their primary
 *  company unless one is given. */
export async function addContactToCampaign(
  campaignId: string,
  contactId: string,
  ctx?: ServiceContext,
  opts: { companyId?: string } = {}
): Promise<ActionResult<{ id: string }>> {
  let companyId = opts.companyId ?? null
  if (!companyId) {
    const client = await getClient(ctx)
    const { data } = await client
      .from('contact_companies')
      .select('company_id')
      .eq('contact_id', contactId)
      .eq('is_primary', true)
      .is('deleted_at', null)
      .maybeSingle()
    companyId = (data?.company_id as string | undefined) ?? null
  }
  return upsertMember(campaignId, { companyId, contactId }, ctx)
}

/**
 * Add every live company whose industry is one of the campaign's target
 * industries. Returns how many were newly added (existing members are skipped).
 */
export async function addTargetIndustryCompanies(
  campaignId: string,
  ctx?: ServiceContext
): Promise<ActionResult<{ added: number }>> {
  try {
    const client = await getClient(ctx)
    const { data: campaign, error: campaignError } = await client
      .from('campaigns')
      .select('target_industries')
      .eq('id', campaignId)
      .is('deleted_at', null)
      .single()
    if (campaignError) return { success: false, error: campaignError.message }

    const industries = (campaign.target_industries as string[]) ?? []
    if (industries.length === 0) {
      return { success: false, error: 'Set target industries on the campaign first' }
    }

    const [{ data: companies, error: companiesError }, { data: members, error: membersError }] =
      await Promise.all([
        // Company industry is free text, so match case-insensitively ("salon" is
        // a Salon). ilike without wildcards = case-insensitive equality.
        client
          .from('companies')
          .select('id')
          .or(
            industries.map((i) => `industry.ilike.${quotePostgrestValue(escapeLike(i))}`).join(',')
          )
          .is('deleted_at', null),
        client
          .from('campaign_members')
          .select('company_id')
          .eq('campaign_id', campaignId)
          .is('contact_id', null)
          .is('deleted_at', null),
      ])
    if (companiesError) return { success: false, error: companiesError.message }
    if (membersError) return { success: false, error: membersError.message }

    const already = new Set((members ?? []).map((m) => m.company_id as string))
    const toAdd = (companies ?? []).map((c) => c.id as string).filter((id) => !already.has(id))

    if (toAdd.length === 0) return { success: true, data: { added: 0 } }

    // One bulk insert. The unique index only covers live rows, so earlier
    // removed memberships stay as history alongside the new ones.
    const userId = await getUserId(ctx)
    const { error } = await client.from('campaign_members').insert(
      toAdd.map((companyId) => ({
        campaign_id: campaignId,
        company_id: companyId,
        created_by: userId,
        updated_by: userId,
      }))
    )
    if (error) return { success: false, error: error.message }
    return { success: true, data: { added: toAdd.length } }
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to add companies') }
  }
}

/** Record how far a member got in the campaign funnel. */
export async function setCampaignMemberStatus(
  membershipId: string,
  status: CampaignMemberStatus,
  ctx?: ServiceContext
): Promise<ActionResult<void>> {
  try {
    const client = await getClient(ctx)
    const userId = await getUserId(ctx)
    const { data, error } = await client
      .from('campaign_members')
      .update({ status, updated_by: userId })
      .eq('id', membershipId)
      .is('deleted_at', null)
      .select('id')
    if (error) return { success: false, error: error.message }
    if (!data || data.length === 0) {
      return { success: false, error: 'Permission denied or member not found' }
    }
    return { success: true, data: undefined }
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to update member status') }
  }
}

export async function removeCampaignMember(
  membershipId: string,
  ctx?: ServiceContext
): Promise<ActionResult<void>> {
  try {
    const client = await getClient(ctx)
    const userId = await getUserId(ctx)
    const { data, error } = await client
      .from('campaign_members')
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq('id', membershipId)
      .select('id')
    if (error) return { success: false, error: error.message }
    if (!data || data.length === 0) {
      return { success: false, error: 'Permission denied or member not found' }
    }
    return { success: true, data: undefined }
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to remove member') }
  }
}
