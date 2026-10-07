import { describe, expect, it } from 'vitest'
import {
  canManageCampaign,
  computeCampaignStats,
  computeOutcomeBreakdown,
  type Campaign,
} from './campaigns'

/** A v_campaigns row with only the count columns that matter here. */
function row(counts: Partial<Campaign>): Campaign {
  return {
    member_count: 0,
    sent_count: 0,
    bounced_count: 0,
    opened_count: 0,
    responded_count: 0,
    converted_count: 0,
    ...counts,
  } as Campaign
}

// The seeded "4th of July Booking Boost": 30 members, all sent, 3 bounced,
// 18 opened, 9 responded, 6 converted.
const july = row({
  member_count: 30,
  sent_count: 30,
  bounced_count: 3,
  opened_count: 18,
  responded_count: 9,
  converted_count: 6,
})

describe('computeCampaignStats', () => {
  it('derives counts and rates from the cumulative funnel', () => {
    expect(computeCampaignStats(july)).toEqual({
      members: 30,
      sent: 30,
      delivered: 27,
      opened: 18,
      responded: 9,
      converted: 6,
      openRate: 18 / 27,
      responseRate: 9 / 27,
      successRate: 6 / 30,
    })
  })

  it('returns null rates (not 0 or NaN) when nothing was sent', () => {
    const stats = computeCampaignStats(row({ member_count: 30 }))
    expect(stats.openRate).toBeNull()
    expect(stats.responseRate).toBeNull()
    expect(stats.successRate).toBeNull()
  })

  it('returns a null open rate when everything bounced', () => {
    const stats = computeCampaignStats(row({ member_count: 2, sent_count: 2, bounced_count: 2 }))
    expect(stats.delivered).toBe(0)
    expect(stats.openRate).toBeNull()
    expect(stats.successRate).toBe(0)
  })

  it('treats missing view counts as zero', () => {
    const stats = computeCampaignStats({} as Campaign)
    expect(stats.members).toBe(0)
    expect(stats.successRate).toBeNull()
  })
})

describe('computeOutcomeBreakdown', () => {
  it('counts every member once, at the furthest stage reached', () => {
    const b = computeOutcomeBreakdown(july)
    expect(b).toEqual({
      converted: 6,
      responded: 3,
      opened: 9,
      sent: 9,
      bounced: 3,
      notSent: 0,
    })
    // The stack must add back up to the member count.
    expect(Object.values(b).reduce((a, n) => a + n, 0)).toBe(30)
  })

  it('puts an unsent draft entirely in notSent', () => {
    expect(computeOutcomeBreakdown(row({ member_count: 12 }))).toEqual({
      converted: 0,
      responded: 0,
      opened: 0,
      sent: 0,
      bounced: 0,
      notSent: 12,
    })
  })

  it('has exactly the six stack segments, never negative', () => {
    const b = computeOutcomeBreakdown(july)
    expect(Object.keys(b).sort()).toEqual(
      ['bounced', 'converted', 'notSent', 'opened', 'responded', 'sent'].sort()
    )
    for (const n of Object.values(b)) expect(n).toBeGreaterThanOrEqual(0)
  })
})

describe('canManageCampaign (mirrors campaign RLS)', () => {
  const owned = { owner_id: 'u-editor' }
  it.each([
    [
      'an admin, any campaign',
      { id: 'u-admin', role: 'Admin' as const },
      { owner_id: 'u-x' },
      true,
    ],
    ['an editor, their own campaign', { id: 'u-editor', role: 'Editor' as const }, owned, true],
    [
      "an editor, someone else's campaign",
      { id: 'u-other', role: 'Editor' as const },
      owned,
      false,
    ],
    ['a viewer, even as recorded owner', { id: 'u-editor', role: 'Viewer' as const }, owned, false],
    [
      'an editor, an unowned campaign',
      { id: 'u-editor', role: 'Editor' as const },
      { owner_id: null },
      false,
    ],
  ])('%s → %s', (_label, user, campaign, expected) => {
    expect(canManageCampaign(user, campaign)).toBe(expected)
  })
})
