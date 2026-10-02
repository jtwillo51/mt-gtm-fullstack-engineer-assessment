'use client'

import type { ReactNode } from 'react'
import { Sheet } from '@/components/ui/sheet'

/** Shell every form renders inside. Thin wrapper over the base Sheet. */
export function FormSheet({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title}>
      {children}
    </Sheet>
  )
}
