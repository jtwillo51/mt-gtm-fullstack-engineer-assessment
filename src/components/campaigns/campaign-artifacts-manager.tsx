'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Link2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmButton } from '@/components/ui/confirm-button'
import { usePermissions } from '@/components/permission-provider'
import { createClient } from '@/lib/supabase/client'
import {
  CAMPAIGN_ARTIFACTS_BUCKET,
  CAMPAIGN_ARTIFACT_MAX_BYTES,
  CAMPAIGN_ARTIFACT_MIME_TYPES,
} from '@/lib/config/constants'
import { handleActionError } from '@/lib/utils/toast-helpers'
import type { CampaignArtifact } from '@/lib/services/campaign-artifacts'
import {
  addCampaignFileArtifactAction,
  addCampaignLinkArtifactAction,
  removeCampaignArtifactAction,
} from '@/actions/campaigns'

/**
 * Campaign creative: screenshots of the email, the flyer that was mailed, etc.
 * Files upload straight from the browser to the private Storage bucket (RLS
 * gates it to editors), then a server action records the artifact row. Links
 * are recorded directly.
 */
export function CampaignArtifactsManager({
  campaignId,
  artifacts,
}: {
  campaignId: string
  artifacts: CampaignArtifact[]
}) {
  const router = useRouter()
  const { canEdit } = usePermissions()
  const [pending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)
  const [showLinkForm, setShowLinkForm] = useState(false)
  const [linkTitle, setLinkTitle] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const busy = pending || uploading

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-choosing the same file
    if (!file) return
    if (!CAMPAIGN_ARTIFACT_MIME_TYPES.includes(file.type)) {
      toast.error('Upload a PNG, JPG, GIF, WebP or PDF')
      return
    }
    if (file.size > CAMPAIGN_ARTIFACT_MAX_BYTES) {
      toast.error('Files must be 10 MB or smaller')
      return
    }

    setUploading(true)
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-')
      const path = `${campaignId}/${crypto.randomUUID()}-${safeName}`
      const bucket = createClient().storage.from(CAMPAIGN_ARTIFACTS_BUCKET)
      const { error } = await bucket.upload(path, file, { contentType: file.type })
      if (error) {
        toast.error(error.message || 'Upload failed')
        return
      }
      const result = await addCampaignFileArtifactAction(campaignId, {
        title: file.name.replace(/\.[^.]+$/, ''),
        storage_path: path,
        mime_type: file.type,
        size_bytes: file.size,
      }).catch(() => ({ success: false as const, error: 'Failed to save file' }))
      if (!result.success) {
        // Roll back the upload so the bucket doesn't collect files no artifact
        // points to. Storage RLS (0006) only allows deleting unreferenced
        // objects you uploaded; best-effort, the error toast is what matters.
        await bucket.remove([path]).catch(() => {})
        handleActionError(result, 'Failed to save file')
        return
      }
      toast.success('Artifact uploaded')
      router.refresh()
    } finally {
      setUploading(false)
    }
  }

  function onAddLink(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await addCampaignLinkArtifactAction(campaignId, {
        title: linkTitle,
        url: linkUrl,
      })
      if (handleActionError(result, 'Failed to add link')) return
      setLinkTitle('')
      setLinkUrl('')
      setShowLinkForm(false)
      router.refresh()
    })
  }

  function onRemove(id: string) {
    startTransition(async () => {
      const result = await removeCampaignArtifactAction(id)
      if (handleActionError(result, 'Failed to remove artifact')) return
      router.refresh()
    })
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Artifacts</h3>
        {canEdit ? (
          <div className="flex items-center gap-1">
            <input
              ref={fileInput}
              type="file"
              accept={CAMPAIGN_ARTIFACT_MIME_TYPES.join(',')}
              className="hidden"
              onChange={onFileChosen}
            />
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              {uploading ? 'Uploading…' : 'Upload'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => setShowLinkForm((v) => !v)}
            >
              <Link2 className="h-3.5 w-3.5" />
              Add link
            </Button>
          </div>
        ) : null}
      </div>

      {showLinkForm ? (
        <form onSubmit={onAddLink} className="mb-4 flex flex-wrap items-center gap-2">
          <Input
            value={linkTitle}
            onChange={(e) => setLinkTitle(e.target.value)}
            placeholder="Title, e.g. Flyer front"
            className="w-48"
            required
          />
          <Input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://…"
            type="url"
            className="min-w-56 flex-1"
            required
          />
          <Button type="submit" size="sm" disabled={busy}>
            Add
          </Button>
        </form>
      ) : null}

      {artifacts.length === 0 ? (
        <p className="text-sm text-slate-400">
          No artifacts yet. Add screenshots of the email, the flyer, or links to the creative.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {artifacts.map((a) => (
            <li
              key={a.id}
              className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
            >
              <a
                href={a.href ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="block"
                title={a.title}
              >
                <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-white">
                  {a.isImage && a.href ? (
                    // Signed Storage URLs aren't a configured next/image domain.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.href} alt={a.title} className="h-full w-full object-cover" />
                  ) : a.kind === 'link' ? (
                    <Link2 className="h-8 w-8 text-slate-300" />
                  ) : (
                    <FileText className="h-8 w-8 text-slate-300" />
                  )}
                </div>
                <p className="truncate border-t border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700">
                  {a.title}
                </p>
              </a>
              {canEdit ? (
                <ConfirmButton
                  label={`Remove ${a.title}`}
                  disabled={busy}
                  onConfirm={() => onRemove(a.id)}
                  size="sm"
                  // Revealed on hover/focus with a mouse; always visible on
                  // touch screens, which have no hover.
                  className="absolute right-1.5 top-1.5 h-7 rounded-full bg-white/90 px-1.5 text-slate-500 opacity-0 shadow-sm transition-opacity hover:text-slate-900 focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </ConfirmButton>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
