'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Button, type ButtonProps } from './button'
import { cn } from '@/lib/utils'

/**
 * Two-step destructive button: the first click arms it (it turns red and reads
 * `confirmLabel`), the second click within `timeoutMs` runs `onConfirm`.
 * Escape, blur or the timeout disarm it. One button element throughout, so
 * keyboard focus stays put between the two presses.
 *
 * Lighter than a modal for row-level actions (remove a member / artifact),
 * but still impossible to trigger with a single stray click.
 */
export function ConfirmButton({
  onConfirm,
  label,
  confirmLabel = 'Remove?',
  children,
  disabled,
  size = 'icon',
  variant = 'ghost',
  className,
  timeoutMs = 4000,
}: {
  onConfirm: () => void
  /** Accessible name in the resting state, e.g. "Remove Lena Patel". */
  label: string
  /** Visible text (and accessible name) once armed. */
  confirmLabel?: string
  /** Resting content, usually an icon. */
  children: ReactNode
  disabled?: boolean
  size?: ButtonProps['size']
  variant?: ButtonProps['variant']
  className?: string
  timeoutMs?: number
}) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), timeoutMs)
    return () => clearTimeout(t)
  }, [armed, timeoutMs])

  return (
    <Button
      type="button"
      variant={armed ? 'destructive' : variant}
      size={armed ? 'sm' : size}
      disabled={disabled}
      aria-label={armed ? `${confirmLabel} ${label}` : label}
      className={cn(className, armed && 'opacity-100')}
      onClick={(e) => {
        e.stopPropagation()
        if (!armed) {
          setArmed(true)
          return
        }
        setArmed(false)
        onConfirm()
      }}
      onBlur={() => setArmed(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setArmed(false)
      }}
    >
      {armed ? confirmLabel : children}
    </Button>
  )
}
