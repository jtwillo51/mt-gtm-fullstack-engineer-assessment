import { cn } from '@/lib/utils'

/** Circular initials avatar for people. */
const SIZES = {
  xs: 'h-5 w-5 text-[10px]',
  sm: 'h-7 w-7 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-10 w-10 text-sm',
  xl: 'h-12 w-12 text-base',
} as const

function initials(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return '?'
  const parts = trimmed.split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return trimmed.slice(0, 2).toUpperCase()
}

export function InitialsAvatar({
  name,
  size = 'md',
  className,
}: {
  name: string | null | undefined
  size?: keyof typeof SIZES
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-700',
        SIZES[size],
        className
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}
