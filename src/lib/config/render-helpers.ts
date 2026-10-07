import type { BadgeVariant } from '@/components/ui/badge'

/**
 * Maps a status-like string to a semantic badge variant. Add the statuses your
 * model uses (e.g. a campaign's Draft / Active / Completed). Unknown values
 * fall back to `default`. Keep this the single source for status → color so
 * badges read consistently across the app.
 */
export const STATUS_VARIANT_MAP: Record<string, BadgeVariant> = {
  Active: 'success',
  Completed: 'muted',
  Draft: 'subtle',
  Primary: 'subtle',
  // Campaign audience
  Internal: 'info',
  External: 'warning',
  // Campaign member funnel stages
  Targeted: 'default',
  Sent: 'subtle',
  Opened: 'info',
  Responded: 'warning',
  Converted: 'success',
  Bounced: 'muted',
}

export function badgeVariantForStatus(value: string): BadgeVariant {
  return STATUS_VARIANT_MAP[value] ?? 'default'
}
