import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { RecentCampaignsChart, type RecentCampaignRow } from './recent-campaigns-chart'

const rows: RecentCampaignRow[] = [
  {
    id: 'mailer',
    name: 'Holiday Gift Card Mailer',
    breakdown: { converted: 0, responded: 0, opened: 0, sent: 0, bounced: 0, notSent: 30 },
  },
  {
    id: 'july',
    name: '4th of July Booking Boost',
    breakdown: { converted: 7, responded: 3, opened: 9, sent: 8, bounced: 3, notSent: 1 },
  },
]

describe('RecentCampaignsChart', () => {
  it('shows a legend with every outcome, Converted first', () => {
    render(<RecentCampaignsChart rows={rows} />)
    const legend = screen.getByLabelText('Legend')
    expect(
      within(legend)
        .getAllByRole('listitem')
        .map((li) => li.textContent)
    ).toEqual(['Converted', 'Responded', 'Opened', 'Sent', 'Bounced', 'Not sent'])
  })

  it('draws one bar per campaign with only its non-empty segments', () => {
    render(<RecentCampaignsChart rows={rows} />)
    const mailer = screen.getByLabelText(/^Holiday Gift Card Mailer:/)
    expect(mailer.children).toHaveLength(1)
    expect(mailer.getAttribute('aria-label')).toBe('Holiday Gift Card Mailer: 30 not sent')

    const july = screen.getByLabelText(/^4th of July Booking Boost:/)
    expect(july.children).toHaveLength(6)
  })

  it('sizes bars relative to the largest campaign and labels the total', () => {
    render(<RecentCampaignsChart rows={rows} />)
    // July (31 members) is the largest, so it spans the full track.
    expect((screen.getByLabelText(/^4th of July Booking Boost:/) as HTMLElement).style.width).toBe(
      '100%'
    )
    expect(
      parseFloat((screen.getByLabelText(/^Holiday Gift Card Mailer:/) as HTMLElement).style.width)
    ).toBeCloseTo((30 / 31) * 100)
    expect(screen.getByText('30')).toBeTruthy()
    expect(screen.getByText('31')).toBeTruthy()
  })

  it('shows a tooltip with count and share on hover', () => {
    render(<RecentCampaignsChart rows={rows} />)
    const converted = screen.getByLabelText(/^4th of July Booking Boost:/).children[0]
    fireEvent.mouseEnter(converted)
    expect(screen.getByRole('tooltip').textContent).toContain('Converted: 7 of 31 (23%)')
    fireEvent.mouseLeave(converted)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('switches to a table with the same numbers and a success rate', () => {
    render(<RecentCampaignsChart rows={rows} />)
    fireEvent.click(screen.getByRole('button', { name: /Table/ }))
    const july = screen.getByRole('link', { name: '4th of July Booking Boost' }).closest('tr')!
    const cells = within(july)
      .getAllByRole('cell')
      .map((td) => td.textContent)
    // Campaign, Converted, Responded, Opened, Sent, Bounced, Not sent, Members, Success
    expect(cells).toEqual(['4th of July Booking Boost', '7', '3', '9', '8', '3', '1', '31', '23%'])

    const mailer = screen.getByRole('link', { name: 'Holiday Gift Card Mailer' }).closest('tr')!
    expect(within(mailer).getAllByRole('cell').at(-1)?.textContent).toBe('—')
  })

  it('links each campaign to its detail page', () => {
    render(<RecentCampaignsChart rows={rows} />)
    expect(
      screen.getByRole('link', { name: '4th of July Booking Boost' }).getAttribute('href')
    ).toBe('/campaigns/july')
  })

  it('shows an empty state with no campaigns', () => {
    render(<RecentCampaignsChart rows={[]} />)
    expect(screen.getByText('No campaigns yet.')).toBeTruthy()
  })
})
