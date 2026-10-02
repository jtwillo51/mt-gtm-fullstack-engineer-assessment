'use client'

import { useForm, type FieldValues } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { companyFields, companySections } from '@/lib/config/models/company-config'
import {
  companySchema,
  companyUpdateSchema,
  type CompanyFormInput,
  type CompanyUpdateInput,
} from '@/lib/schemas'
import type { Company } from '@/lib/services/companies'
import { FormSheet } from '@/components/page/form-sheet'
import { Button } from '@/components/ui/button'
import { ConfigFormSections } from './config-form-sections'
import { FormLoadingSkeleton } from './form-loading-skeleton'
import { useMutationSuccess } from '@/lib/hooks/use-mutation-helpers'
import { useCompany } from '@/lib/hooks/use-entity'
import { handleActionError, handleActionResult } from '@/lib/utils/toast-helpers'
import { createCompanyAction, updateCompanyAction } from '@/actions/companies'

interface CompanyFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId?: string | null
}

export function CompanyForm({ open, onOpenChange, companyId }: CompanyFormProps) {
  const { data: company, isLoading } = useCompany(open ? (companyId ?? null) : null)
  const isEditing = !!companyId

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? 'Edit Company' : 'New Company'}
    >
      {isEditing && (isLoading || !company) ? (
        <FormLoadingSkeleton />
      ) : (
        <CompanyFormContent
          company={company ?? null}
          isEditing={isEditing}
          onOpenChange={onOpenChange}
        />
      )}
    </FormSheet>
  )
}

function CompanyFormContent({
  company,
  isEditing,
  onOpenChange,
}: {
  company: Company | null
  isEditing: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const { onMutationSuccess } = useMutationSuccess()

  const form = useForm<FieldValues>({
    resolver: zodResolver(isEditing ? companyUpdateSchema : companySchema),
    defaultValues: {
      name: company?.name ?? '',
      website: company?.website ?? '',
      industry: company?.industry ?? '',
    },
  })

  const onSubmit = async (data: FieldValues) => {
    if (isEditing && company) {
      const result = await updateCompanyAction(company.id, data as CompanyUpdateInput)
      if (handleActionError(result, 'Failed to update company')) return
      onOpenChange(false)
      await onMutationSuccess('companies', { message: 'Company updated' })
    } else {
      const result = await createCompanyAction(data as CompanyFormInput)
      if (!handleActionResult(result, { success: 'Company created' })) return
      await onMutationSuccess('companies', { skipRefresh: true })
      onOpenChange(false)
      router.push(`/companies/${result.data.id}`)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <ConfigFormSections fields={companyFields} sections={companySections} form={form} />
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Company'}
        </Button>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
