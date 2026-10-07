import { z } from 'zod'
import { emptyStringToNull } from './helpers'

// Option lists are the single source of truth: the DB CHECK constraints in
// 0005_campaigns.sql mirror them, and the model config reads them for selects.
export const CAMPAIGN_TYPES = ['Email', 'Direct Mail', 'SMS', 'Social', 'Event', 'Other'] as const
export const CAMPAIGN_STATUSES = ['Draft', 'Active', 'Completed'] as const
export const CAMPAIGN_AUDIENCES = ['Internal', 'External'] as const
export const CAMPAIGN_INDUSTRIES = [
  'Salon',
  'Spa',
  'Med Spa',
  'Massage',
  'Nail Salon',
  'Barbershop',
  'Lash & Brow',
  'Wellness',
  'Tattoo Studio',
] as const
export const CAMPAIGN_MEMBER_STATUSES = [
  'Targeted',
  'Sent',
  'Opened',
  'Responded',
  'Converted',
  'Bounced',
] as const

export type CampaignMemberStatus = (typeof CAMPAIGN_MEMBER_STATUSES)[number]

// No .default()s here: Zod 4 still applies defaults inside .partial(), so an
// update omitting `status` would silently reset it. Defaults go on create only.
const campaignFields = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  type: z.enum(CAMPAIGN_TYPES, { error: 'Choose a campaign type' }),
  status: z.enum(CAMPAIGN_STATUSES),
  audience: z.enum(CAMPAIGN_AUDIENCES, { error: 'Choose internal or external' }),
  occasion: emptyStringToNull,
  purpose: emptyStringToNull,
  target_industries: z.array(z.enum(CAMPAIGN_INDUSTRIES)),
  // <input type="date"> yields 'YYYY-MM-DD' or ''.
  start_date: emptyStringToNull,
  end_date: emptyStringToNull,
})

const datesOrdered = (v: { start_date?: string | null; end_date?: string | null }) =>
  !v.start_date || !v.end_date || v.end_date >= v.start_date
const datesOrderedError = {
  message: 'End date must be on or after the start date',
  path: ['end_date'],
}

export const campaignSchema = campaignFields
  .extend({
    status: campaignFields.shape.status.default('Draft'),
    target_industries: campaignFields.shape.target_industries.default([]),
  })
  .refine(datesOrdered, datesOrderedError)

// Update = create with every field optional (refine re-applied to the partial).
export const campaignUpdateSchema = campaignFields.partial().refine(datesOrdered, datesOrderedError)

export type CampaignFormInput = z.input<typeof campaignSchema>
export type CampaignUpdateInput = z.input<typeof campaignUpdateSchema>

// A pasted link artifact. File artifacts are uploaded to Storage by the client
// and registered with campaignFileArtifactSchema.
export const campaignLinkArtifactSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  // http(s) only — the URL is rendered as a clickable href.
  url: z.url({ protocol: /^https?$/, error: 'Enter a valid http(s) URL' }),
})

export const campaignFileArtifactSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  storage_path: z.string().min(1),
  mime_type: emptyStringToNull,
  size_bytes: z.number().int().nonnegative().nullable().optional(),
})

export type CampaignLinkArtifactInput = z.input<typeof campaignLinkArtifactSchema>
export type CampaignFileArtifactInput = z.input<typeof campaignFileArtifactSchema>

export const campaignMemberStatusSchema = z.enum(CAMPAIGN_MEMBER_STATUSES)
