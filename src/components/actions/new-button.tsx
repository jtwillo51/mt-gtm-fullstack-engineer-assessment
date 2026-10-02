'use client'

import { Suspense, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { usePermissions } from '@/components/permission-provider'
import { formRegistry, type FormType } from './form-registry'

export function NewButton({
  formType,
  label,
  size,
  defaultCompanyId,
}: {
  formType: FormType
  label: string
  size?: ButtonProps['size']
  defaultCompanyId?: string
}) {
  const [open, setOpen] = useState(false)
  const { canEdit } = usePermissions()
  const entry = formRegistry[formType]
  const { Component } = entry

  if (!canEdit) return null

  const createProps = entry.buildCreateProps?.({ defaultCompanyId }) ?? {}

  return (
    <>
      <Button size={size} onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        {label}
      </Button>
      {open ? (
        <Suspense fallback={null}>
          <Component open={open} onOpenChange={setOpen} {...createProps} />
        </Suspense>
      ) : null}
    </>
  )
}
