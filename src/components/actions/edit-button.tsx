'use client'

import { Suspense, useState } from 'react'
import { Pencil } from 'lucide-react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { usePermissions } from '@/components/permission-provider'
import { formRegistry, type FormType } from './form-registry'

export function EditButton({
  formType,
  recordId,
  label = 'Edit',
  size = 'sm',
}: {
  formType: FormType
  recordId: string
  label?: string
  size?: ButtonProps['size']
}) {
  const [open, setOpen] = useState(false)
  const { canEdit } = usePermissions()
  const entry = formRegistry[formType]
  const { Component } = entry

  if (!canEdit) return null

  return (
    <>
      <Button variant="outline" size={size} onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" />
        {label}
      </Button>
      {open ? (
        <Suspense fallback={null}>
          <Component open={open} onOpenChange={setOpen} {...entry.buildEditProps(recordId)} />
        </Suspense>
      ) : null}
    </>
  )
}
