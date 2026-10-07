import type { FieldConfig, SectionConfig } from './types'

/** Read-only audit fields shared by every model's detail view. */
export const METADATA_FIELDS: FieldConfig[] = [
  {
    name: 'owner_name',
    label: 'Owner',
    section: 'Record Info',
    showInForm: false,
    renderType: 'text',
  },
  {
    name: 'created_at',
    label: 'Created',
    section: 'Record Info',
    showInForm: false,
    renderType: 'datetime',
  },
  {
    name: 'updated_at',
    label: 'Updated',
    section: 'Record Info',
    showInForm: false,
    renderType: 'datetime',
  },
]

export const RECORD_INFO_SECTION: SectionConfig = { id: 'Record Info', columns: 2 }

/** Private Storage bucket for campaign artifacts (created in 0005_campaigns.sql). */
export const CAMPAIGN_ARTIFACTS_BUCKET = 'campaign-artifacts'

/** Upload limits — mirror the bucket's file_size_limit / allowed_mime_types. */
export const CAMPAIGN_ARTIFACT_MAX_BYTES = 10 * 1024 * 1024
export const CAMPAIGN_ARTIFACT_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
]
