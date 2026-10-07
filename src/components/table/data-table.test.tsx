import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { DataTable } from './data-table'
import { campaignListConfig } from '@/lib/config/models/campaign-config'
import { contactChildConfig } from '@/lib/config/models/contact-config'
import type { ListViewConfig } from '@/lib/config/types'

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/campaigns',
  useSearchParams: () => new URLSearchParams(),
}))

const page = <T,>(rows: T[]) => ({
  data: rows,
  pagination: { total: rows.length, limit: 25, offset: 0 },
})

const campaigns = page([
  {
    id: 'c1',
    name: '4th of July Booking Boost',
    type: 'Email',
    audience: 'External',
    status: 'Completed',
    occasion: '4th of July Sale',
    start_date: '2026-06-20',
    end_date: '2026-07-05',
    member_count: 31,
    converted_count: 7,
  },
  {
    id: 'c2',
    name: 'Holiday Gift Card Mailer',
    type: 'Direct Mail',
    audience: 'External',
    status: 'Draft',
    occasion: null,
    start_date: null,
    end_date: null,
    member_count: 30,
    converted_count: 0,
  },
])

beforeEach(() => vi.clearAllMocks())

describe('DataTable row links (keyboard / screen-reader access)', () => {
  it('makes each record name a real, focusable link to its detail page', () => {
    render(<DataTable data={campaigns} config={campaignListConfig} linkPath="/campaigns" />)
    const link = screen.getByRole('link', { name: '4th of July Booking Boost' })
    expect(link.getAttribute('href')).toBe('/campaigns/c1')
    link.focus()
    expect(document.activeElement).toBe(link)
    expect(
      screen.getByRole('link', { name: 'Holiday Gift Card Mailer' }).getAttribute('href')
    ).toBe('/campaigns/c2')
  })

  it('links only the first column, one link per row', () => {
    render(<DataTable data={campaigns} config={campaignListConfig} linkPath="/campaigns" />)
    for (const row of screen.getAllByRole('row').slice(1)) {
      expect(row.querySelectorAll('a')).toHaveLength(1)
      expect(row.querySelector('td:first-child a')).not.toBeNull()
    }
  })

  it('clicking the link does not also trigger the row navigation', () => {
    render(<DataTable data={campaigns} config={campaignListConfig} linkPath="/campaigns" />)
    const link = screen.getByRole('link', { name: '4th of July Booking Boost' })
    // jsdom can't perform a real page navigation; stop it so only our handlers run.
    link.addEventListener('click', (e) => e.preventDefault())
    fireEvent.click(link)
    expect(router.push).not.toHaveBeenCalled()
  })

  it('keeps the whole row clickable for mouse users', () => {
    render(<DataTable data={campaigns} config={campaignListConfig} linkPath="/campaigns" />)
    fireEvent.click(screen.getByText('Direct Mail'))
    expect(router.push).toHaveBeenCalledWith('/campaigns/c2')
  })

  it('wraps rich name cells (avatar + full name) in the link', () => {
    const contacts = page([
      {
        id: 'p1',
        first_name: 'Lena',
        last_name: 'Patel',
        email: 'lena@x.example',
        title: 'Barber',
        primary: 'Primary',
      },
    ])
    render(<DataTable data={contacts} config={contactChildConfig} linkPath="/contacts" />)
    const link = screen.getByRole('link', { name: /Lena Patel/ })
    expect(link.getAttribute('href')).toBe('/contacts/p1')
  })

  it('does not nest links when the first column is already a url/email link', () => {
    const config: ListViewConfig = {
      columns: [
        { field: 'email', label: 'Email', defaultVisible: true, renderType: 'email' },
        { field: 'name', label: 'Name', defaultVisible: true },
      ],
      defaultSort: { field: 'email', asc: true },
    }
    const { container } = render(
      <DataTable
        data={page([{ id: 'x1', email: 'a@b.example', name: 'A' }])}
        config={config}
        linkPath="/contacts"
      />
    )
    expect(container.querySelectorAll('a a')).toHaveLength(0)
    expect(screen.getByRole('link', { name: 'a@b.example' }).getAttribute('href')).toBe(
      'mailto:a@b.example'
    )
  })

  it('renders no links in the empty state', () => {
    render(<DataTable data={page([])} config={campaignListConfig} linkPath="/campaigns" />)
    expect(screen.getByText('No records found.')).toBeTruthy()
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })
})

describe('DataTable search box', () => {
  it('says what it searches when the list config provides a placeholder', () => {
    render(<DataTable data={campaigns} config={campaignListConfig} linkPath="/campaigns" />)
    expect(screen.getByPlaceholderText('Search name or occasion')).toBeTruthy()
  })

  it('falls back to the generic placeholder for other lists', () => {
    render(<DataTable data={page([])} config={contactChildConfig} linkPath="/contacts" />)
    expect(screen.getByPlaceholderText('Search…')).toBeTruthy()
  })

  it('pushes the search into the URL and resets to page 1', () => {
    render(<DataTable data={campaigns} config={campaignListConfig} linkPath="/campaigns" />)
    const box = screen.getByPlaceholderText('Search name or occasion')
    fireEvent.change(box, { target: { value: 'Smith, John' } })
    fireEvent.submit(box.closest('form')!)
    expect(router.push).toHaveBeenCalledWith('/campaigns?search=Smith%2C+John')
  })
})
