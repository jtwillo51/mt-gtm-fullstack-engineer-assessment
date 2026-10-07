'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmButton } from '@/components/ui/confirm-button'
import { usePermissions } from '@/components/permission-provider'
import { useMutationSuccess } from '@/lib/hooks/use-mutation-helpers'
import { handleActionError } from '@/lib/utils/toast-helpers'
import type { ModelName } from '@/lib/query-keys'
import type { ActionResult } from '@/lib/services/base'
import { deleteCampaignAction } from '@/actions/campaigns'
import type { FormType } from './form-registry'

/** Models with a delete control. Add an entry to offer Delete on another model. */
const deleteRegistry = {
  campaign: { action: deleteCampaignAction, model: 'campaigns', label: 'campaign' },
} satisfies Partial<
  Record<
    FormType,
    { action: (id: string) => Promise<ActionResult<void>>; model: ModelName; label: string }
  >
>

/**
 * Soft-delete the record (two-step confirm), then go back to its list. Shown
 * to editors; RLS still decides (owner-or-admin), and a refusal is a toast.
 */
export function DeleteButton({
  formType,
  recordId,
  redirectTo,
}: {
  formType: keyof typeof deleteRegistry
  recordId: string
  redirectTo: string
}) {
  const router = useRouter()
  const { canEdit } = usePermissions()
  const { onMutationSuccess } = useMutationSuccess()
  const [pending, startTransition] = useTransition()
  const entry = deleteRegistry[formType]

  if (!canEdit) return null

  return (
    <ConfirmButton
      label={`Delete ${entry.label}`}
      confirmLabel={`Delete ${entry.label}?`}
      variant="outline"
      size="sm"
      disabled={pending}
      onConfirm={() =>
        startTransition(async () => {
          const result = await entry.action(recordId)
          if (handleActionError(result, `Failed to delete ${entry.label}`)) return
          await onMutationSuccess(entry.model, { skipRefresh: true })
          toast.success(`Deleted ${entry.label}`)
          router.push(redirectTo)
        })
      }
    >
      <Trash2 className="h-4 w-4" />
      Delete
    </ConfirmButton>
  )
}
