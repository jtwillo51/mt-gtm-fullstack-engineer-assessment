import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useForm, type FieldValues, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ConfigFormSections } from './config-form-sections'
import { campaignFields, campaignSections } from '@/lib/config/models/campaign-config'
import {
  CAMPAIGN_AUDIENCES,
  CAMPAIGN_INDUSTRIES,
  CAMPAIGN_STATUSES,
  CAMPAIGN_TYPES,
  campaignSchema,
} from '@/lib/schemas/campaign.schema'

/** The campaign form exactly as CampaignForm wires it, minus the server action. */
function CampaignFormHarness({ onValid }: { onValid: (data: FieldValues) => void }) {
  const form = useForm<FieldValues>({
    // Same resolver CampaignForm uses; widened to the form's untyped values.
    resolver: zodResolver(campaignSchema) as unknown as Resolver<FieldValues>,
    defaultValues: {
      name: '',
      type: '',
      audience: '',
      status: 'Draft',
      occasion: '',
      start_date: '',
      end_date: '',
      purpose: '',
      target_industries: [],
    },
  })
  return (
    <form onSubmit={form.handleSubmit(onValid)}>
      <ConfigFormSections fields={campaignFields} sections={campaignSections} form={form} />
      <button type="submit">Save</button>
    </form>
  )
}

function renderForm() {
  const onValid = vi.fn()
  const { container } = render(<CampaignFormHarness onValid={onValid} />)
  const byName = <T extends Element>(name: string) =>
    container.querySelector<T & Element>(`[name="${name}"]`)!
  return { onValid, container, byName }
}

const optionValues = (select: HTMLSelectElement) =>
  Array.from(select.options)
    .map((o) => o.value)
    .filter(Boolean)

describe('campaign form inputs', () => {
  it('renders each field as the right kind of control', () => {
    const { byName } = renderForm()
    expect(byName<HTMLInputElement>('name').type).toBe('text')
    expect(byName<HTMLInputElement>('occasion').type).toBe('text')
    expect(byName<HTMLInputElement>('start_date').type).toBe('date')
    expect(byName<HTMLInputElement>('end_date').type).toBe('date')
    expect(byName('purpose').tagName).toBe('TEXTAREA')
    expect(byName('type').tagName).toBe('SELECT')
    expect(byName('audience').tagName).toBe('SELECT')
    expect(byName('status').tagName).toBe('SELECT')
  })

  it('offers exactly the schema options in each select', () => {
    const { byName } = renderForm()
    expect(optionValues(byName('type'))).toEqual([...CAMPAIGN_TYPES])
    expect(optionValues(byName('audience'))).toEqual([...CAMPAIGN_AUDIENCES])
    expect(optionValues(byName('status'))).toEqual([...CAMPAIGN_STATUSES])
  })

  it('renders one checkbox per target industry', () => {
    const { container } = renderForm()
    const boxes = container.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"][name="target_industries"]'
    )
    expect(Array.from(boxes).map((b) => b.value)).toEqual([...CAMPAIGN_INDUSTRIES])
  })

  it('never renders the read-only Record Info fields', () => {
    const { byName } = renderForm()
    for (const name of ['owner_name', 'created_at', 'updated_at']) {
      expect(byName(name)).toBeNull()
    }
  })

  it('marks required fields with an asterisk', () => {
    renderForm()
    for (const label of ['Campaign Name', 'Type', 'Audience', 'Status']) {
      expect(screen.getByText(label).parentElement?.textContent).toContain('*')
    }
  })

  it('keeps single-field section labels for screen readers only', () => {
    const { container } = renderForm()
    const purposeLabel = container.querySelector('label[for="purpose"]')!
    expect(purposeLabel.className).toContain('sr-only')
    expect(container.querySelector('label[for="name"]')!.className).not.toContain('sr-only')
  })
})

describe('campaign form submission', () => {
  it('blocks submit and shows messages when required fields are missing', async () => {
    const { onValid } = renderForm()
    fireEvent.click(screen.getByText('Save'))
    expect(await screen.findByText('Campaign name is required')).toBeTruthy()
    expect(screen.getByText('Choose a campaign type')).toBeTruthy()
    expect(screen.getByText('Choose internal or external')).toBeTruthy()
    expect(onValid).not.toHaveBeenCalled()
  })

  it('rejects an end date before the start date', async () => {
    const { byName, onValid } = renderForm()
    fireEvent.change(byName('name'), { target: { value: 'Promo' } })
    fireEvent.change(byName('type'), { target: { value: 'Email' } })
    fireEvent.change(byName('audience'), { target: { value: 'External' } })
    fireEvent.change(byName('start_date'), { target: { value: '2026-07-10' } })
    fireEvent.change(byName('end_date'), { target: { value: '2026-07-01' } })
    fireEvent.click(screen.getByText('Save'))
    expect(await screen.findByText('End date must be on or after the start date')).toBeTruthy()
    expect(onValid).not.toHaveBeenCalled()
  })

  it('submits a typed campaign: industries as a list, blanks as null', async () => {
    const { container, byName, onValid } = renderForm()
    fireEvent.change(byName('name'), { target: { value: '4th of July Boost' } })
    fireEvent.change(byName('type'), { target: { value: 'Direct Mail' } })
    fireEvent.change(byName('audience'), { target: { value: 'Internal' } })
    fireEvent.change(byName('status'), { target: { value: 'Active' } })
    fireEvent.change(byName('start_date'), { target: { value: '2026-06-20' } })
    fireEvent.change(byName('purpose'), { target: { value: 'Drive bookings' } })
    for (const industry of ['Salon', 'Barbershop']) {
      fireEvent.click(
        container.querySelector(`input[name="target_industries"][value="${industry}"]`)!
      )
    }
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => expect(onValid).toHaveBeenCalledTimes(1))
    expect(onValid.mock.calls[0][0]).toEqual({
      name: '4th of July Boost',
      type: 'Direct Mail',
      audience: 'Internal',
      status: 'Active',
      occasion: null,
      purpose: 'Drive bookings',
      start_date: '2026-06-20',
      end_date: null,
      target_industries: ['Salon', 'Barbershop'],
    })
  })

  it('unchecking an industry removes it', async () => {
    const { container, byName, onValid } = renderForm()
    fireEvent.change(byName('name'), { target: { value: 'X' } })
    fireEvent.change(byName('type'), { target: { value: 'SMS' } })
    fireEvent.change(byName('audience'), { target: { value: 'External' } })
    const spa = container.querySelector('input[name="target_industries"][value="Spa"]')!
    fireEvent.click(spa)
    fireEvent.click(spa)
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(onValid).toHaveBeenCalled())
    expect(onValid.mock.calls[0][0].target_industries).toEqual([])
  })
})
