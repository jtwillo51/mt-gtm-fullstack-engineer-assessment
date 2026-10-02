import type { FieldConfig, RenderType, SectionConfig } from '@/lib/config/types'
import { Badge } from '@/components/ui/badge'
import { badgeVariantForStatus } from '@/lib/config/render-helpers'
import { cn } from '@/lib/utils'

/**
 * Read-only detail renderer, config-driven. Shows fields with
 * `showInDetail !== false`, grouped by section into cards. Mirrors the form.
 */
export function DetailView<T extends object>({
  fields,
  sections,
  record,
}: {
  fields: FieldConfig[]
  sections: SectionConfig[]
  record: T
}) {
  const row = record as Record<string, unknown>
  const visible = fields.filter((f) => f.showInDetail !== false)

  return (
    <div className="space-y-4">
      {sections.map((section) => {
        const sectionFields = visible.filter((f) => f.section === section.id)
        if (sectionFields.length === 0) return null
        return (
          <section
            key={section.id}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {section.id}
            </h3>
            <dl
              className={cn(
                'grid gap-x-8 gap-y-4',
                section.columns === 2 ? 'sm:grid-cols-2' : 'grid-cols-1'
              )}
            >
              {sectionFields.map((field) => (
                <div key={field.name}>
                  <dt className="text-xs text-slate-400">{field.label}</dt>
                  <dd className="mt-1 text-sm text-slate-800">
                    {renderValue(row[field.name], field.renderType)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )
      })}
    </div>
  )
}

function renderValue(value: unknown, renderType?: RenderType) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-slate-300">—</span>
  }
  const str = String(value)
  switch (renderType) {
    case 'badge':
      return <Badge variant={badgeVariantForStatus(str)}>{str}</Badge>
    case 'url':
      return (
        <a href={str} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
          {str}
        </a>
      )
    case 'email':
      return (
        <a href={`mailto:${str}`} className="text-indigo-600 hover:underline">
          {str}
        </a>
      )
    case 'datetime':
      return <span>{new Date(str).toLocaleString()}</span>
    default:
      return <span>{str}</span>
  }
}
