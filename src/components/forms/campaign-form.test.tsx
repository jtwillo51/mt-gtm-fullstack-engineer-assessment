import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CampaignForm } from './campaign-form'
import type { Campaign } from '@/lib/services/campaigns'

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

const actions = vi.hoisted(() => ({
  createCampaignAction: vi.fn(),
  updateCampaignAction: vi.fn(),
  getCampaignAction: vi.fn(),
}))
vi.mock('@/actions/campaigns', () => actions)

const existing = {
  id: 'camp-1',
  name: '4th of July Booking Boost',
  type: 'Email',
  status: 'Completed',
  audience: 'External',
  occasion: '4th of July Sale',
  purpose: 'Win new salons',
  target_industries: ['Salon', 'Barbershop'],
  start_date: '2026-06-20',
  end_date: '2026-07-05',
} as Campaign

function renderForm(props: { campaignId?: string } = {}) {
  const onOpenChange = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const utils = render(
    <QueryClientProvider client={client}>
      <CampaignForm open onOpenChange={onOpenChange} {...props} />
    </QueryClientProvider>
  )
  const field = <T extends Element>(name: string) =>
    utils.container.querySelector<T & Element>(`[name="${name}"]`)!
  return { ...utils, onOpenChange, field }
}

beforeEach(() => {
  vi.clearAllMocks()
  actions.getCampaignAction.mockResolvedValue(existing)
})

describe('CampaignForm — create', () => {
  it('opens as "New Campaign" with Draft preselected', () => {
    const { field } = renderForm()
    expect(screen.getByRole('dialog', { name: 'New Campaign' })).toBeTruthy()
    expect(field<HTMLSelectElement>('status').value).toBe('Draft')
    expect(actions.getCampaignAction).not.toHaveBeenCalled()
  })

  it('creates the campaign with parsed values and opens it', async () => {
    actions.createCampaignAction.mockResolvedValue({ success: true, data: { id: 'new-id' } })
    const { field, container, onOpenChange } = renderForm()
    fireEvent.change(field('name'), { target: { value: 'Halloween Flash Sale' } })
    fireEvent.change(field('type'), { target: { value: 'Social' } })
    fireEvent.change(field('audience'), { target: { value: 'External' } })
    fireEvent.change(field('occasion'), { target: { value: 'Halloween' } })
    fireEvent.click(container.querySelector('input[value="Tattoo Studio"]')!)
    fireEvent.click(screen.getByRole('button', { name: 'Create Campaign' }))

    await waitFor(() => expect(actions.createCampaignAction).toHaveBeenCalledTimes(1))
    expect(actions.createCampaignAction.mock.calls[0][0]).toMatchObject({
      name: 'Halloween Flash Sale',
      type: 'Social',
      audience: 'External',
      status: 'Draft',
      occasion: 'Halloween',
      purpose: null,
      target_industries: ['Tattoo Studio'],
      start_date: null,
      end_date: null,
    })
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/campaigns/new-id'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(toast.success).toHaveBeenCalledWith('Campaign created')
  })

  it('does not call the server when the form is invalid', async () => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: 'Create Campaign' }))
    expect(await screen.findByText('Campaign name is required')).toBeTruthy()
    expect(actions.createCampaignAction).not.toHaveBeenCalled()
  })

  it('keeps the sheet open and shows the error when the server rejects', async () => {
    actions.createCampaignAction.mockResolvedValue({ success: false, error: 'permission denied' })
    const { field, onOpenChange } = renderForm()
    fireEvent.change(field('name'), { target: { value: 'X' } })
    fireEvent.change(field('type'), { target: { value: 'Email' } })
    fireEvent.change(field('audience'), { target: { value: 'Internal' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Campaign' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('permission denied'))
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    expect(router.push).not.toHaveBeenCalled()
  })
})

describe('CampaignForm — edit', () => {
  it('loads the campaign and prefills every input', async () => {
    const { field, container } = renderForm({ campaignId: 'camp-1' })
    expect(screen.getByRole('dialog', { name: 'Edit Campaign' })).toBeTruthy()
    await waitFor(() => expect(field<HTMLInputElement>('name').value).toBe(existing.name))
    expect(actions.getCampaignAction).toHaveBeenCalledWith('camp-1')
    expect(field<HTMLSelectElement>('type').value).toBe('Email')
    expect(field<HTMLSelectElement>('audience').value).toBe('External')
    expect(field<HTMLSelectElement>('status').value).toBe('Completed')
    expect(field<HTMLInputElement>('occasion').value).toBe('4th of July Sale')
    expect(field<HTMLTextAreaElement>('purpose').value).toBe('Win new salons')
    expect(field<HTMLInputElement>('start_date').value).toBe('2026-06-20')
    expect(field<HTMLInputElement>('end_date').value).toBe('2026-07-05')
    const checked = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[name="target_industries"]:checked')
    ).map((b) => b.value)
    expect(checked).toEqual(['Salon', 'Barbershop'])
  })

  it('saves changes through the update action and refreshes', async () => {
    actions.updateCampaignAction.mockResolvedValue({ success: true, data: existing })
    const { field, onOpenChange } = renderForm({ campaignId: 'camp-1' })
    await waitFor(() => expect(field<HTMLInputElement>('name').value).toBe(existing.name))
    fireEvent.change(field('status'), { target: { value: 'Active' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => expect(actions.updateCampaignAction).toHaveBeenCalledTimes(1))
    const [id, data] = actions.updateCampaignAction.mock.calls[0]
    expect(id).toBe('camp-1')
    expect(data).toMatchObject({ status: 'Active', target_industries: ['Salon', 'Barbershop'] })
    expect(onOpenChange).toHaveBeenCalledWith(false)
    await waitFor(() => expect(router.refresh).toHaveBeenCalled())
  })
})
