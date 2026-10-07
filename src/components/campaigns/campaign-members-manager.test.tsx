import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { CampaignMembersManager } from './campaign-members-manager'
import { PermissionProvider } from '@/components/permission-provider'
import { CAMPAIGN_MEMBER_STATUSES } from '@/lib/schemas/campaign.schema'
import type { CampaignMemberRow } from '@/lib/services/campaign-members'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const actions = vi.hoisted(() => ({
  addCompanyToCampaignAction: vi.fn(),
  addContactToCampaignAction: vi.fn(),
  addTargetIndustryCompaniesAction: vi.fn(),
  removeCampaignMemberAction: vi.fn(),
  searchCampaignMemberOptionsAction: vi.fn(),
  setCampaignMemberStatusAction: vi.fn(),
}))
vi.mock('@/actions/campaigns', () => actions)

const members: CampaignMemberRow[] = [
  {
    id: 'm-contact',
    kind: 'contact',
    company_id: 'co-1',
    contact_id: 'ct-1',
    name: 'Lena Patel',
    company_name: 'Abara Hair Studio',
    company_industry: 'Salon',
    email: 'lena@abara.example',
    title: 'Barber',
    status: 'Opened',
  },
  {
    id: 'm-company',
    kind: 'company',
    company_id: 'co-2',
    contact_id: null,
    name: 'Belmont Skin Clinic',
    company_name: 'Belmont Skin Clinic',
    company_industry: 'Med Spa',
    email: null,
    title: null,
    status: 'Sent',
  },
]

function renderAs(canEdit: boolean, ui: ReactNode) {
  return render(
    <PermissionProvider value={{ role: canEdit ? 'Editor' : 'Viewer', canEdit }}>
      {ui}
    </PermissionProvider>
  )
}

const manager = (props: Partial<Parameters<typeof CampaignMembersManager>[0]> = {}) => (
  <CampaignMembersManager campaignId="camp-1" members={members} hasTargetIndustries {...props} />
)

beforeEach(() => {
  vi.clearAllMocks()
  for (const fn of Object.values(actions)) fn.mockResolvedValue({ success: true, data: undefined })
  actions.searchCampaignMemberOptionsAction.mockResolvedValue([])
})

describe('CampaignMembersManager — editor', () => {
  it('links people to contacts and companies to companies', () => {
    renderAs(true, manager())
    expect(screen.getByRole('link', { name: /Lena Patel/ }).getAttribute('href')).toBe(
      '/contacts/ct-1'
    )
    expect(screen.getByRole('link', { name: /Belmont Skin Clinic/ }).getAttribute('href')).toBe(
      '/companies/co-2'
    )
  })

  it('offers every outcome in each member’s select, preselected to the current one', () => {
    renderAs(true, manager())
    const select = screen.getByLabelText('Outcome for Lena Patel') as HTMLSelectElement
    expect(Array.from(select.options).map((o) => o.value)).toEqual([...CAMPAIGN_MEMBER_STATUSES])
    expect(select.value).toBe('Opened')
  })

  it('records a new outcome and refreshes the page', async () => {
    renderAs(true, manager())
    fireEvent.change(screen.getByLabelText('Outcome for Lena Patel'), {
      target: { value: 'Converted' },
    })
    await waitFor(() =>
      expect(actions.setCampaignMemberStatusAction).toHaveBeenCalledWith('m-contact', 'Converted')
    )
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('removes a member only after a second, confirming click', async () => {
    renderAs(true, manager())
    fireEvent.click(screen.getByLabelText('Remove Belmont Skin Clinic'))
    expect(actions.removeCampaignMemberAction).not.toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText('Remove? Remove Belmont Skin Clinic'))
    await waitFor(() =>
      expect(actions.removeCampaignMemberAction).toHaveBeenCalledWith('m-company')
    )
  })

  it('bulk-adds target-industry companies', async () => {
    actions.addTargetIndustryCompaniesAction.mockResolvedValue({
      success: true,
      data: { added: 4 },
    })
    renderAs(true, manager())
    fireEvent.click(screen.getByRole('button', { name: /Add all target-industry companies/ }))
    await waitFor(() =>
      expect(actions.addTargetIndustryCompaniesAction).toHaveBeenCalledWith('camp-1')
    )
  })

  it('hides the bulk add when the campaign has no target industries', () => {
    renderAs(true, manager({ hasTargetIndustries: false }))
    expect(screen.queryByRole('button', { name: /Add all target-industry companies/ })).toBeNull()
  })

  describe('member picker', () => {
    beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))

    it('searches people by default, excludes existing members, and adds a pick', async () => {
      actions.searchCampaignMemberOptionsAction.mockResolvedValue([
        { id: 'ct-1', label: 'Lena Patel', detail: 'Abara Hair Studio' }, // already a member
        { id: 'ct-9', label: 'Lena Ortiz', detail: 'Lotus Spa' },
      ])
      renderAs(true, manager())
      const input = screen.getByPlaceholderText('Add a person by name')
      fireEvent.focus(input)
      fireEvent.change(input, { target: { value: 'Lena' } })
      await act(() => vi.advanceTimersByTimeAsync(250))

      expect(actions.searchCampaignMemberOptionsAction).toHaveBeenLastCalledWith('contact', 'Lena')
      // Picker results are named by label; the row's remove button is "Remove Lena Patel".
      const results = await screen.findAllByRole('button', { name: /^Lena/ })
      expect(results.map((b) => b.textContent)).toEqual(['Lena OrtizLotus Spa'])

      fireEvent.click(results[0])
      await waitFor(() =>
        expect(actions.addContactToCampaignAction).toHaveBeenCalledWith('camp-1', 'ct-9')
      )
      vi.useRealTimers()
    })

    it('says so when nothing matches', async () => {
      renderAs(true, manager())
      const input = screen.getByPlaceholderText('Add a person by name')
      fireEvent.focus(input)
      fireEvent.change(input, { target: { value: 'Zzz' } })
      await act(() => vi.advanceTimersByTimeAsync(250))
      expect((await screen.findByRole('status')).textContent).toBe('No people match “Zzz”.')
      vi.useRealTimers()
    })

    it('shows an error instead of failing silently when search throws', async () => {
      actions.searchCampaignMemberOptionsAction.mockRejectedValue(new Error('500'))
      renderAs(true, manager())
      const input = screen.getByPlaceholderText('Add a person by name')
      fireEvent.focus(input)
      fireEvent.change(input, { target: { value: 'Lena' } })
      await act(() => vi.advanceTimersByTimeAsync(250))
      expect((await screen.findByRole('status')).textContent).toBe('Search failed — try again.')
      vi.useRealTimers()
    })

    it('switches to searching companies', async () => {
      renderAs(true, manager())
      fireEvent.click(screen.getByRole('button', { name: 'Company' }))
      const input = screen.getByPlaceholderText('Add a company by name')
      fireEvent.focus(input)
      fireEvent.change(input, { target: { value: 'Bel' } })
      await act(() => vi.advanceTimersByTimeAsync(250))
      expect(actions.searchCampaignMemberOptionsAction).toHaveBeenLastCalledWith('company', 'Bel')
      vi.useRealTimers()
    })
  })
})

describe('CampaignMembersManager — viewer', () => {
  it('shows outcomes as read-only badges with no edit controls', () => {
    renderAs(false, manager())
    expect(screen.queryAllByRole('combobox')).toHaveLength(0)
    expect(screen.queryByPlaceholderText(/Add a/)).toBeNull()
    expect(screen.queryByLabelText(/^Remove/)).toBeNull()
    const row = screen.getByRole('link', { name: /Lena Patel/ }).closest('tr')!
    expect(within(row).getByText('Opened')).toBeTruthy()
  })
})
