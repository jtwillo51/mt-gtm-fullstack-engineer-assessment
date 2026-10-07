import { describe, expect, it, vi } from 'vitest'
import { createCRUDActions } from './factory'
import { validate } from './validate'
import {
  campaignSchema,
  campaignUpdateSchema,
  companySchema,
  type CampaignFormInput,
  type CampaignUpdateInput,
} from '@/lib/schemas'

function makeActions() {
  const service = {
    create: vi.fn(async (input: unknown) => ({ success: true as const, data: input })),
    update: vi.fn(async (_id: string, input: unknown) => ({ success: true as const, data: input })),
    delete: vi.fn(async () => ({ success: true as const, data: undefined })),
  }
  const actions = createCRUDActions<unknown, CampaignFormInput, CampaignUpdateInput>({
    serviceName: 'campaign',
    schemas: { create: campaignSchema, update: campaignUpdateSchema },
    service,
  })
  return { actions, service }
}

describe('validate', () => {
  it('returns parsed (transformed) data on success', () => {
    const v = validate(companySchema, { name: 'Acme', website: '', industry: '' })
    expect(v).toEqual({ ok: true, data: { name: 'Acme', website: null, industry: null } })
  })

  it("returns the first issue's message, not the raw ZodError JSON", () => {
    const v = validate(companySchema, { name: '' })
    expect(v).toEqual({ ok: false, error: { success: false, error: 'Company name is required' } })
  })
})

describe('createCRUDActions', () => {
  it('create: validates, then calls the service with parsed data', async () => {
    const { actions, service } = makeActions()
    const result = await actions.create({ name: 'Spring', type: 'Email', audience: 'External' })
    expect(result.success).toBe(true)
    // Create-schema defaults applied before the service sees it.
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Spring', status: 'Draft', target_industries: [] })
    )
  })

  it('create: invalid input returns a readable error and never calls the service', async () => {
    const { actions, service } = makeActions()
    const result = await actions.create({ name: '', type: 'Email', audience: 'External' })
    expect(result).toEqual({ success: false, error: 'Campaign name is required' })
    expect(service.create).not.toHaveBeenCalled()
  })

  it('update: invalid input returns a readable error', async () => {
    const { actions, service } = makeActions()
    const result = await actions.update('id', {
      start_date: '2026-07-10',
      end_date: '2026-07-01',
    })
    expect(result).toEqual({
      success: false,
      error: 'End date must be on or after the start date',
    })
    expect(service.update).not.toHaveBeenCalled()
  })

  it('wraps a thrown service error into an ActionResult', async () => {
    const { actions, service } = makeActions()
    service.delete.mockRejectedValueOnce(new Error('connection refused'))
    expect(await actions.delete('id')).toEqual({ success: false, error: 'connection refused' })
  })
})
