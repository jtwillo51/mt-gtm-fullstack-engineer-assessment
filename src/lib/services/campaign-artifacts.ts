import {
  type ActionResult,
  type ServiceContext,
  getClient,
  getErrorMessage,
  getUserId,
} from './base'
import type { CampaignFileArtifactInput, CampaignLinkArtifactInput } from '@/lib/schemas'
import { CAMPAIGN_ARTIFACTS_BUCKET } from '@/lib/config/constants'

/** How long a signed URL for an uploaded artifact stays valid. */
const SIGNED_URL_TTL_SECONDS = 60 * 60

export interface CampaignArtifact {
  id: string
  campaign_id: string
  kind: 'file' | 'link'
  title: string
  url: string | null
  storage_path: string | null
  mime_type: string | null
  size_bytes: number | null
  created_at: string
  /** Where to open/preview it: the link itself, or a short-lived signed URL. */
  href: string | null
  isImage: boolean
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp)(\?.*)?$/i

/** Artifacts for a campaign, oldest first, with viewable URLs resolved. */
export async function listCampaignArtifacts(
  campaignId: string,
  ctx?: ServiceContext
): Promise<CampaignArtifact[]> {
  const client = await getClient(ctx)
  const { data, error } = await client
    .from('campaign_artifacts')
    .select('id, campaign_id, kind, title, url, storage_path, mime_type, size_bytes, created_at')
    .eq('campaign_id', campaignId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
  if (error) throw error

  const rows = (data ?? []) as Omit<CampaignArtifact, 'href' | 'isImage'>[]
  const paths = rows.filter((r) => r.kind === 'file').map((r) => r.storage_path!)

  const signedByPath = new Map<string, string>()
  if (paths.length > 0) {
    const { data: signed, error: signError } = await client.storage
      .from(CAMPAIGN_ARTIFACTS_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)
    if (signError) throw signError
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) signedByPath.set(s.path, s.signedUrl)
    }
  }

  return rows.map((r) => {
    const isFile = r.kind === 'file'
    return {
      ...r,
      href: isFile ? (signedByPath.get(r.storage_path!) ?? null) : r.url,
      isImage: isFile ? (r.mime_type ?? '').startsWith('image/') : IMAGE_EXT.test(r.url ?? ''),
    }
  })
}

export async function addCampaignLinkArtifact(
  campaignId: string,
  input: CampaignLinkArtifactInput,
  ctx?: ServiceContext
): Promise<ActionResult<{ id: string }>> {
  try {
    const client = await getClient(ctx)
    const userId = await getUserId(ctx)
    const { data, error } = await client
      .from('campaign_artifacts')
      .insert({
        campaign_id: campaignId,
        kind: 'link',
        title: input.title,
        url: input.url,
        created_by: userId,
        updated_by: userId,
      })
      .select('id')
      .single()
    if (error) return { success: false, error: error.message }
    return { success: true, data: { id: data.id as string } }
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to add link') }
  }
}

/**
 * Register a file the client already uploaded to Storage. The path must live
 * under this campaign's folder so one campaign can't claim another's files.
 */
export async function addCampaignFileArtifact(
  campaignId: string,
  input: CampaignFileArtifactInput,
  ctx?: ServiceContext
): Promise<ActionResult<{ id: string }>> {
  try {
    if (!input.storage_path.startsWith(`${campaignId}/`)) {
      return { success: false, error: 'File does not belong to this campaign' }
    }
    const client = await getClient(ctx)
    const userId = await getUserId(ctx)
    const { data, error } = await client
      .from('campaign_artifacts')
      .insert({
        campaign_id: campaignId,
        kind: 'file',
        title: input.title,
        storage_path: input.storage_path,
        mime_type: input.mime_type ?? null,
        size_bytes: input.size_bytes ?? null,
        created_by: userId,
        updated_by: userId,
      })
      .select('id')
      .single()
    if (error) return { success: false, error: error.message }
    return { success: true, data: { id: data.id as string } }
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to save file') }
  }
}

/** Soft-delete the artifact row. The Storage object is kept (forward-only,
 *  like every other record) and simply stops being listed. */
export async function removeCampaignArtifact(
  artifactId: string,
  ctx?: ServiceContext
): Promise<ActionResult<void>> {
  try {
    const client = await getClient(ctx)
    const userId = await getUserId(ctx)
    const { data, error } = await client
      .from('campaign_artifacts')
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq('id', artifactId)
      .select('id')
    if (error) return { success: false, error: error.message }
    if (!data || data.length === 0) {
      return { success: false, error: 'Permission denied or artifact not found' }
    }
    return { success: true, data: undefined }
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to remove artifact') }
  }
}
