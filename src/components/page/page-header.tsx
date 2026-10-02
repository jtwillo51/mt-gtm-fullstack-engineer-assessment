import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

/** Consistent page header: optional back link, glyph, title + subtitle, actions. */
export function PageHeader({
  title,
  subtitle,
  glyph,
  actions,
  backHref,
  backLabel,
}: {
  title: string
  subtitle?: ReactNode
  glyph?: ReactNode
  actions?: ReactNode
  backHref?: string
  backLabel?: string
}) {
  return (
    <div className="mb-6">
      {backHref ? (
        <Link
          href={backHref}
          className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
        >
          <ChevronLeft className="h-4 w-4" />
          {backLabel ?? 'Back'}
        </Link>
      ) : null}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {glyph}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
            {subtitle ? <div className="mt-0.5 text-sm text-slate-500">{subtitle}</div> : null}
          </div>
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}
