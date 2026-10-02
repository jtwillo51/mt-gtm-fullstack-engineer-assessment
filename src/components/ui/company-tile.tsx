import { cn } from '@/lib/utils'

/** Square monogram for companies. Color is hash-deterministic from the name. */
const PALETTE = [
  '#6366f1', // periwinkle
  '#06b6d4', // cyan
  '#fb923c', // peach
  '#ec4899', // pink
  '#a855f7', // purple
  '#d946ef', // magenta
]

const SIZES = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-10 w-10 text-base',
  xl: 'h-12 w-12 text-lg',
} as const

export function CompanyTile({
  name,
  size = 'md',
  className,
}: {
  name: string | null | undefined
  size?: keyof typeof SIZES
  className?: string
}) {
  const label = (name ?? '?').trim()
  const initial = label.charAt(0).toUpperCase() || '?'
  let hash = 0
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0
  const color = PALETTE[hash % PALETTE.length]

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md font-semibold text-white',
        SIZES[size],
        className
      )}
      style={{ backgroundColor: color }}
      aria-hidden
    >
      {initial}
    </span>
  )
}
