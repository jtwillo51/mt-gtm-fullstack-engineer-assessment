'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BarChart3, Table2 } from 'lucide-react'
import type { CampaignOutcomeBreakdown } from '@/lib/services/campaigns'
import { cn } from '@/lib/utils'

export interface RecentCampaignRow {
  id: string
  name: string
  breakdown: CampaignOutcomeBreakdown
}

type StageKey = keyof CampaignOutcomeBreakdown

/**
 * Stack order = legend order. Converted sits on the baseline so the outcome
 * that matters lines up across bars. The funnel stages are ORDERED, so they
 * use one blue ramp light→dark (dataviz reference ramp, steps 250/400/550/700,
 * validated as an ordinal ramp); off-funnel states are neutral grays.
 */
const STAGES: { key: StageKey; label: string; color: string }[] = [
  { key: 'converted', label: 'Converted', color: '#0d366b' },
  { key: 'responded', label: 'Responded', color: '#1c5cab' },
  { key: 'opened', label: 'Opened', color: '#3987e5' },
  { key: 'sent', label: 'Sent', color: '#86b6ef' },
  { key: 'bounced', label: 'Bounced', color: '#94a3b8' },
  { key: 'notSent', label: 'Not sent', color: '#e2e8f0' },
]

function total(b: CampaignOutcomeBreakdown) {
  return STAGES.reduce((sum, s) => sum + b[s.key], 0)
}

function pct(n: number, d: number) {
  return d > 0 ? `${Math.round((n / d) * 100)}%` : '—'
}

/** Members of the most recent campaigns, stacked by the furthest stage each reached. */
export function RecentCampaignsChart({ rows }: { rows: RecentCampaignRow[] }) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const [hover, setHover] = useState<{ row: string; stage: StageKey } | null>(null)

  const max = Math.max(1, ...rows.map((r) => total(r.breakdown)))

  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Recent campaign results</h2>
          <p className="text-xs text-slate-500">
            Members of the {rows.length} most recent campaigns, by how far each got
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
          {(
            [
              ['chart', 'Chart', BarChart3],
              ['table', 'Table', Table2],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              onClick={() => setView(key)}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium',
                view === key
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-500 hover:text-slate-900'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">No campaigns yet.</p>
      ) : view === 'chart' ? (
        <>
          <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1" aria-label="Legend">
            {STAGES.map((s) => (
              <li key={s.key} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
                {s.label}
              </li>
            ))}
          </ul>

          <ul className="space-y-3">
            {rows.map((row) => {
              const t = total(row.breakdown)
              return (
                <li
                  key={row.id}
                  className="grid grid-cols-[minmax(0,11rem)_1fr] items-center gap-3"
                >
                  <Link
                    href={`/campaigns/${row.id}`}
                    className="truncate text-sm text-slate-700 hover:text-slate-900 hover:underline"
                    title={row.name}
                  >
                    {row.name}
                  </Link>
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-5 gap-[2px]"
                      style={{ width: `${(t / max) * 100}%` }}
                      role="img"
                      aria-label={`${row.name}: ${STAGES.filter((s) => row.breakdown[s.key] > 0)
                        .map((s) => `${row.breakdown[s.key]} ${s.label.toLowerCase()}`)
                        .join(', ')}`}
                    >
                      {STAGES.filter((s) => row.breakdown[s.key] > 0).map((s, i, visible) => {
                        const n = row.breakdown[s.key]
                        const active = hover?.row === row.id && hover.stage === s.key
                        return (
                          <div
                            key={s.key}
                            className={cn(
                              'relative h-full min-w-[3px] transition-opacity',
                              // Rounded data end (the tip); the baseline end stays square.
                              i === visible.length - 1 && 'rounded-r',
                              hover && !active && 'opacity-60'
                            )}
                            style={{ flexGrow: n, flexBasis: 0, backgroundColor: s.color }}
                            onMouseEnter={() => setHover({ row: row.id, stage: s.key })}
                            onMouseLeave={() => setHover(null)}
                          >
                            {active ? (
                              <div
                                role="tooltip"
                                className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-lg"
                              >
                                <p className="font-medium text-slate-900">{row.name}</p>
                                <p className="flex items-center gap-1.5 text-slate-600">
                                  <span
                                    className="h-2 w-2 rounded-sm"
                                    style={{ backgroundColor: s.color }}
                                  />
                                  {s.label}: {n} of {t} ({pct(n, t)})
                                </p>
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                    <span className="shrink-0 text-xs text-slate-500">{t}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="py-2 pl-2 pr-4">Campaign</th>
                {STAGES.map((s) => (
                  <th key={s.key} className="px-2 py-2 text-right">
                    {s.label}
                  </th>
                ))}
                <th className="px-2 py-2 text-right">Members</th>
                <th className="py-2 pl-2 pr-2 text-right">Success</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const t = total(row.breakdown)
                const sent = t - row.breakdown.notSent
                return (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 last:border-0 even:bg-slate-50"
                  >
                    <td className="py-2 pl-2 pr-4">
                      <Link
                        href={`/campaigns/${row.id}`}
                        className="text-slate-900 hover:underline"
                      >
                        {row.name}
                      </Link>
                    </td>
                    {STAGES.map((s) => (
                      <td key={s.key} className="px-2 py-2 text-right tabular-nums text-slate-700">
                        {row.breakdown[s.key]}
                      </td>
                    ))}
                    <td className="px-2 py-2 text-right tabular-nums text-slate-700">{t}</td>
                    <td className="py-2 pl-2 pr-2 text-right tabular-nums text-slate-700">
                      {pct(row.breakdown.converted, sent)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
