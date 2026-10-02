'use client'

import { useForm, type FieldValues } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { contactFields, contactSections } from '@/lib/config/models/contact-config'
import {
  contactSchema,
  contactUpdateSchema,
  type ContactFormInput,
  type ContactUpdateInput,
} from '@/lib/schemas'
import type { Contact } from '@/lib/services/contacts'
import { FormSheet } from '@/components/page/form-sheet'
import { Button } from '@/components/ui/button'
import { ConfigFormSections } from './config-form-sections'
import { FormLoadingSkeleton } from './form-loading-skeleton'
import { useMutationSuccess } from '@/lib/hooks/use-mutation-helpers'
import { useContact } from '@/lib/hooks/use-entity'
import { handleActionError, handleActionResult } from '@/lib/utils/toast-helpers'
import { updateContactAction, createContactForCompanyAction } from '@/actions/contacts'

interface ContactFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactId?: string | null
  /** Required for create — new contacts are created attached to a company. */
  defaultCompanyId?: string | null
}

export function ContactForm({ open, onOpenChange, contactId, defaultCompanyId }: ContactFormProps) {
  const { data: contact, isLoading } = useContact(open ? (contactId ?? null) : null)
  const isEditing = !!contactId

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? 'Edit Contact' : 'New Contact'}
    >
      {isEditing && (isLoading || !contact) ? (
        <FormLoadingSkeleton />
      ) : (
        <ContactFormContent
          contact={contact ?? null}
          isEditing={isEditing}
          defaultCompanyId={defaultCompanyId ?? null}
          onOpenChange={onOpenChange}
        />
      )}
    </FormSheet>
  )
}

function ContactFormContent({
  contact,
  isEditing,
  defaultCompanyId,
  onOpenChange,
}: {
  contact: Contact | null
  isEditing: boolean
  defaultCompanyId: string | null
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const { onMutationSuccess } = useMutationSuccess()

  const form = useForm<FieldValues>({
    resolver: zodResolver(isEditing ? contactUpdateSchema : contactSchema),
    defaultValues: {
      first_name: contact?.first_name ?? '',
      last_name: contact?.last_name ?? '',
      email: contact?.email ?? '',
      title: contact?.title ?? '',
    },
  })

  const onSubmit = async (data: FieldValues) => {
    if (isEditing && contact) {
      const result = await updateContactAction(contact.id, data as ContactUpdateInput)
      if (handleActionError(result, 'Failed to update contact')) return
      onOpenChange(false)
      await onMutationSuccess('contacts', { message: 'Contact updated' })
      return
    }

    if (!defaultCompanyId) {
      handleActionError({ success: false, error: 'Missing company' }, 'Missing company')
      return
    }
    const result = await createContactForCompanyAction(defaultCompanyId, data as ContactFormInput)
    if (!handleActionResult(result, { success: 'Contact added' })) return
    await onMutationSuccess('contacts', { skipRefresh: true })
    onOpenChange(false)
    router.push(`/contacts/${result.data.id}`)
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <ConfigFormSections fields={contactFields} sections={contactSections} form={form} />
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Contact'}
        </Button>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
