'use server'

import { createCRUDActions } from '@/lib/actions/factory'
import { validate } from '@/lib/actions/validate'
import {
  campaignSchema,
  campaignUpdateSchema,
  campaignLinkArtifactSchema,
  campaignFileArtifactSchema,
  campaignMemberStatusSchema,
  type CampaignFormInput,
  type CampaignUpdateInput,
  type CampaignLinkArtifactInput,
  type CampaignFileArtifactInput,
} from '@/lib/schemas'
import {
  createCampaign,
  updateCampaign,
  deleteCampaign,
  getCampaign,
  type Campaign,
} from '@/lib/services/campaigns'
import {
  addCompanyToCampaign,
  addContactToCampaign,
  addTargetIndustryCompanies,
  setCampaignMemberStatus,
  removeCampaignMember,
} from '@/lib/services/campaign-members'
import {
  addCampaignLinkArtifact,
  addCampaignFileArtifact,
  removeCampaignArtifact,
} from '@/lib/services/campaign-artifacts'
import { listCompanies } from '@/lib/services/companies'
import { listContacts } from '@/lib/services/contacts'
import type { ActionResult } from '@/lib/services/base'

const campaignActions = createCRUDActions<Campaign, CampaignFormInput, CampaignUpdateInput>({
  serviceName: 'campaign',
  schemas: { create: campaignSchema, update: campaignUpdateSchema },
  service: { create: createCampaign, update: updateCampaign, delete: deleteCampaign },
})

export const createCampaignAction = campaignActions.create
export const updateCampaignAction = campaignActions.update
export const deleteCampaignAction = campaignActions.delete

/** For the edit form's data load. */
export async function getCampaignAction(id: string): Promise<Campaign | null> {
  return getCampaign(id)
}

// --- Members (campaign detail → Members) ---

export async function addCompanyToCampaignAction(
  campaignId: string,
  companyId: string
): Promise<ActionResult<{ id: string }>> {
  return addCompanyToCampaign(campaignId, companyId)
}

export async function addContactToCampaignAction(
  campaignId: string,
  contactId: string
): Promise<ActionResult<{ id: string }>> {
  return addContactToCampaign(campaignId, contactId)
}

export async function addTargetIndustryCompaniesAction(
  campaignId: string
): Promise<ActionResult<{ added: number }>> {
  return addTargetIndustryCompanies(campaignId)
}

export async function setCampaignMemberStatusAction(
  membershipId: string,
  status: string
): Promise<ActionResult<void>> {
  const v = validate(campaignMemberStatusSchema, status)
  if (!v.ok) return v.error
  return setCampaignMemberStatus(membershipId, v.data)
}

export async function removeCampaignMemberAction(
  membershipId: string
): Promise<ActionResult<void>> {
  return removeCampaignMember(membershipId)
}

/** Typeahead options for the member pickers (top 10 matches). */
export async function searchCampaignMemberOptionsAction(
  kind: 'company' | 'contact',
  search: string
): Promise<{ id: string; label: string; detail: string | null }[]> {
  const opts = { limit: 10, search: search.trim() || undefined }
  if (kind === 'company') {
    const result = await listCompanies(opts)
    return result.data.map((c) => ({ id: c.id, label: c.name, detail: c.industry }))
  }
  const result = await listContacts(opts)
  return result.data.map((c) => ({
    id: c.id,
    label: [c.first_name, c.last_name].filter(Boolean).join(' '),
    detail: c.primary_company_name ?? null,
  }))
}

// --- Artifacts (campaign detail → Artifacts) ---

export async function addCampaignLinkArtifactAction(
  campaignId: string,
  input: CampaignLinkArtifactInput
): Promise<ActionResult<{ id: string }>> {
  const v = validate(campaignLinkArtifactSchema, input)
  if (!v.ok) return v.error
  return addCampaignLinkArtifact(campaignId, v.data)
}

export async function addCampaignFileArtifactAction(
  campaignId: string,
  input: CampaignFileArtifactInput
): Promise<ActionResult<{ id: string }>> {
  const v = validate(campaignFileArtifactSchema, input)
  if (!v.ok) return v.error
  return addCampaignFileArtifact(campaignId, v.data)
}

export async function removeCampaignArtifactAction(
  artifactId: string
): Promise<ActionResult<void>> {
  return removeCampaignArtifact(artifactId)
}
