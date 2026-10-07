'use client'

import { useForm, type FieldValues } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { campaignFields, campaignSections } from '@/lib/config/models/campaign-config'
import {
  campaignSchema,
  campaignUpdateSchema,
  type CampaignFormInput,
  type CampaignUpdateInput,
} from '@/lib/schemas'
import type { Campaign } from '@/lib/services/campaigns'
import { FormSheet } from '@/components/page/form-sheet'
import { Button } from '@/components/ui/button'
import { ConfigFormSections } from './config-form-sections'
import { FormLoadingSkeleton } from './form-loading-skeleton'
import { useMutationSuccess } from '@/lib/hooks/use-mutation-helpers'
import { useCampaign } from '@/lib/hooks/use-entity'
import { handleActionError, handleActionResult } from '@/lib/utils/toast-helpers'
import { createCampaignAction, updateCampaignAction } from '@/actions/campaigns'

interface CampaignFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaignId?: string | null
}

export function CampaignForm({ open, onOpenChange, campaignId }: CampaignFormProps) {
  const { data: campaign, isLoading } = useCampaign(open ? (campaignId ?? null) : null)
  const isEditing = !!campaignId

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? 'Edit Campaign' : 'New Campaign'}
    >
      {isEditing && (isLoading || !campaign) ? (
        <FormLoadingSkeleton />
      ) : (
        <CampaignFormContent
          campaign={campaign ?? null}
          isEditing={isEditing}
          onOpenChange={onOpenChange}
        />
      )}
    </FormSheet>
  )
}

function CampaignFormContent({
  campaign,
  isEditing,
  onOpenChange,
}: {
  campaign: Campaign | null
  isEditing: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const { onMutationSuccess } = useMutationSuccess()

  const form = useForm<FieldValues>({
    resolver: zodResolver(isEditing ? campaignUpdateSchema : campaignSchema),
    defaultValues: {
      name: campaign?.name ?? '',
      type: campaign?.type ?? '',
      audience: campaign?.audience ?? '',
      status: campaign?.status ?? 'Draft',
      occasion: campaign?.occasion ?? '',
      start_date: campaign?.start_date ?? '',
      end_date: campaign?.end_date ?? '',
      purpose: campaign?.purpose ?? '',
      // Must start as an array so the checkbox group collects a string[].
      target_industries: campaign?.target_industries ?? [],
    },
  })

  const onSubmit = async (data: FieldValues) => {
    if (isEditing && campaign) {
      const result = await updateCampaignAction(campaign.id, data as CampaignUpdateInput)
      if (handleActionError(result, 'Failed to update campaign')) return
      onOpenChange(false)
      await onMutationSuccess('campaigns', { message: 'Campaign updated' })
    } else {
      const result = await createCampaignAction(data as CampaignFormInput)
      if (!handleActionResult(result, { success: 'Campaign created' })) return
      await onMutationSuccess('campaigns', { skipRefresh: true })
      onOpenChange(false)
      router.push(`/campaigns/${result.data.id}`)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <ConfigFormSections fields={campaignFields} sections={campaignSections} form={form} />
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Campaign'}
        </Button>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
