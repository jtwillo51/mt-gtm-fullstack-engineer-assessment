import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CampaignStats } from './campaign-stats'
import { computeCampaignStats, type Campaign } from '@/lib/services/campaigns'

const july = computeCampaignStats({
  member_count: 31,
  sent_count: 30,
  bounced_count: 3,
  opened_count: 19,
  responded_count: 10,
  converted_count: 7,
} as Campaign)

const donuts = () => screen.getAllByRole('img').map((el) => el.getAttribute('aria-label'))

describe('CampaignStats', () => {
  it('draws one donut per funnel stage with its rate and base', () => {
    render(<CampaignStats stats={july} type="Email" />)
    expect(donuts()).toEqual([
      'Sent: 97% (30 of 31 members)',
      'Opened: 70% (19 of 27 delivered)',
      'Responded: 37% (10 of 27 delivered)',
      'Success rate: 23% (7 of 30 sent)',
    ])
    expect(screen.getByText('31 members')).toBeTruthy()
    expect(screen.getByText('3 bounced')).toBeTruthy()
  })

  it.each(['Direct Mail', 'Event'])(
    'hides the Opened donut for %s (opens not trackable)',
    (type) => {
      render(<CampaignStats stats={july} type={type} />)
      expect(donuts().some((l) => l?.startsWith('Opened'))).toBe(false)
      expect(donuts()).toHaveLength(3)
    }
  )

  it('gives each stage a fixed color, regardless of which donuts show', () => {
    const strokeFor = (label: string) => {
      const svg = screen
        .getAllByRole('img')
        .find((el) => el.getAttribute('aria-label')?.startsWith(label))!
      return svg.querySelectorAll('circle')[1]?.getAttribute('stroke')
    }
    const { unmount } = render(<CampaignStats stats={july} type="Email" />)
    const emailColors = ['Sent', 'Responded', 'Success rate'].map(strokeFor)
    unmount()
    render(<CampaignStats stats={july} type="Direct Mail" />)
    expect(['Sent', 'Responded', 'Success rate'].map(strokeFor)).toEqual(emailColors)
    expect(new Set(emailColors).size).toBe(3)
  })

  it('shows "no data yet" instead of 0% when nothing was sent', () => {
    const draft = computeCampaignStats({ member_count: 30 } as Campaign)
    render(<CampaignStats stats={draft} type="Direct Mail" />)
    expect(donuts()).toEqual([
      'Sent: 0% (0 of 30 members)',
      'Responded: no data yet',
      'Success rate: no data yet',
    ])
  })

  it('shows an empty state with no members', () => {
    render(<CampaignStats stats={computeCampaignStats({} as Campaign)} type="Email" />)
    expect(screen.queryAllByRole('img')).toHaveLength(0)
    expect(screen.getByText(/No members yet/)).toBeTruthy()
  })
})
