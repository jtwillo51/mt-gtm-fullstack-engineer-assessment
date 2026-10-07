import type { CampaignStats as Stats } from '@/lib/services/campaigns'
import { cn } from '@/lib/utils'

/** Channels where "opened" can't be measured (no tracking pixel on a flyer). */
const NO_OPEN_TRACKING = new Set(['Direct Mail', 'Event'])

function pct(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`
}

/**
 * One color per funnel stage, fixed to the stage (never to its position, so
 * hiding Opened for direct mail doesn't repaint the others). Slots 1, 3, 2 and
 * 7 of the dataviz reference palette — validated all-pairs for color-vision
 * deficiency (worst pair ΔE 9.2). Aqua sits under 3:1 on white, which is fine
 * here because every ring prints its value and label.
 */
const STAGE_COLORS = {
  Sent: '#2a78d6', // blue
  Opened: '#1baf7a', // aqua
  Responded: '#eb6834', // orange
  'Success rate': '#4a3aa7', // violet — closest to the app's indigo accent
} as const

type Stage = keyof typeof STAGE_COLORS

interface Ring {
  label: Stage
  count: number
  /** The denominator this stage is measured against. */
  base: number
  baseLabel: string
  hint?: string
  highlight?: boolean
}

/**
 * Campaign performance, derived from member outcomes. Each funnel stage is a
 * progress donut in its own color; the filled arc is the stage's rate against its base,
 * with the percentage in the center and "X of Y" beneath — so the numbers are
 * always readable without the ring. Success rate (converted ÷ sent) is the
 * highlighted headline.
 */
export function CampaignStats({ stats, type }: { stats: Stats; type: string }) {
  const tracksOpens = !NO_OPEN_TRACKING.has(type)
  const bounced = stats.sent - stats.delivered

  const rings: Ring[] = [
    {
      label: 'Sent',
      count: stats.sent,
      base: stats.members,
      baseLabel: 'members',
      hint: bounced > 0 ? `${bounced} bounced` : undefined,
    },
    ...(tracksOpens
      ? [
          {
            label: 'Opened' as const,
            count: stats.opened,
            base: stats.delivered,
            baseLabel: 'delivered',
          },
        ]
      : []),
    { label: 'Responded', count: stats.responded, base: stats.delivered, baseLabel: 'delivered' },
    {
      label: 'Success rate',
      count: stats.converted,
      base: stats.sent,
      baseLabel: 'sent',
      highlight: true,
    },
  ]

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Stats</h3>
        {stats.members > 0 ? (
          <span className="text-xs text-slate-500">
            {stats.members} {stats.members === 1 ? 'member' : 'members'}
          </span>
        ) : null}
      </div>
      {stats.members === 0 ? (
        <p className="text-sm text-slate-400">
          No members yet. Add the companies and people this campaign reached to see results.
        </p>
      ) : (
        <ul
          className={cn(
            'grid grid-cols-2 gap-3',
            rings.length === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'
          )}
        >
          {rings.map((r) => (
            <li
              key={r.label}
              className={cn(
                'flex flex-col items-center rounded-lg border px-3 py-4 text-center',
                r.highlight ? 'border-indigo-200 bg-indigo-50' : 'border-slate-100 bg-slate-50'
              )}
            >
              <Donut
                count={r.count}
                base={r.base}
                label={r.label}
                baseLabel={r.baseLabel}
                color={STAGE_COLORS[r.label]}
              />
              <p className="mt-2 text-sm font-medium text-slate-900">{r.label}</p>
              <p className="text-xs text-slate-500">
                {r.count} of {r.base} {r.baseLabel}
              </p>
              {r.hint ? <p className="text-xs text-slate-400">{r.hint}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const SIZE = 96
const STROKE = 10
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** Single-value progress donut: a colored arc over a pale tint of the same color. */
function Donut({
  count,
  base,
  label,
  baseLabel,
  color,
}: {
  count: number
  base: number
  label: string
  baseLabel: string
  color: string
}) {
  const rate = base > 0 ? Math.min(count / base, 1) : null
  const filled = rate === null ? 0 : rate * CIRCUMFERENCE
  const description =
    rate === null
      ? `${label}: no data yet`
      : `${label}: ${pct(rate)} (${count} of ${base} ${baseLabel})`

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={description}
      className="shrink-0"
    >
      {/* Native hover tooltip with the exact numbers. */}
      <title>{description}</title>
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        stroke={color}
        strokeOpacity={0.15} /* pale track in the ring's own hue */
        strokeWidth={STROKE}
      />
      {rate !== null && rate > 0 ? (
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap={rate < 1 ? 'round' : 'butt'}
          strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
          // Start at 12 o'clock and fill clockwise.
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      ) : null}
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        className="fill-slate-900 text-lg font-semibold"
      >
        {pct(rate)}
      </text>
    </svg>
  )
}
