import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', {
  variants: {
    variant: {
      default: 'bg-slate-100 text-slate-700',
      success: 'bg-cyan-100 text-cyan-700',
      subtle: 'bg-indigo-100 text-indigo-700',
      warning: 'bg-amber-100 text-amber-700',
      info: 'bg-purple-100 text-purple-700',
      muted: 'bg-slate-100 text-slate-500',
    },
  },
  defaultVariants: { variant: 'default' },
})

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
