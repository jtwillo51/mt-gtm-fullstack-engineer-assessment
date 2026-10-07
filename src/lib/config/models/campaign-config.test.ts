import { describe, expect, it } from 'vitest'
import { campaignFields, campaignListConfig, campaignSections } from './campaign-config'
import { campaignSchema } from '@/lib/schemas/campaign.schema'

/**
 * The config drives the form, the detail page and the list. These tests keep
 * it in lockstep with the Zod schema so a field can't be added to one and
 * forgotten in the other.
 */

const formFields = campaignFields.filter(
  (f) => f.showInForm !== false && f.section !== 'Record Info'
)

describe('campaign config ↔ schema', () => {
  it('renders a form input for exactly the fields the schema accepts', () => {
    expect(formFields.map((f) => f.name).sort()).toEqual(Object.keys(campaignSchema.shape).sort())
  })

  it('marks required exactly the fields the schema requires', () => {
    // status has a create default, so the schema accepts it missing; it's still
    // marked required in the UI because the select always holds a value.
    const required = formFields.filter((f) => f.required).map((f) => f.name)
    expect(required.sort()).toEqual(['audience', 'name', 'status', 'type'])
  })

  it('gives every select / multiselect its option list from the schema', () => {
    for (const f of formFields.filter((f) => f.type === 'select' || f.type === 'multiselect')) {
      const shape = campaignSchema.shape[f.name as keyof typeof campaignSchema.shape]
      expect(f.options?.length, f.name).toBeGreaterThan(0)
      // Every option must parse for its field.
      for (const opt of f.options!) {
        const value = f.type === 'multiselect' ? [opt] : opt
        expect(shape.safeParse(value).success, `${f.name}: ${opt}`).toBe(true)
      }
    }
  })

  it('places every field in a declared section', () => {
    const sections = new Set(campaignSections.map((s) => s.id))
    for (const f of campaignFields) expect(sections.has(f.section), f.name).toBe(true)
  })

  it('uses date inputs and date rendering for the date fields', () => {
    for (const name of ['start_date', 'end_date']) {
      const f = campaignFields.find((x) => x.name === name)!
      expect(f.type).toBe('date')
      expect(f.renderType).toBe('date')
    }
  })
})

describe('campaign list columns', () => {
  it('shows the expected columns, in order', () => {
    const visible = campaignListConfig.columns.filter((c) => c.defaultVisible)
    expect(visible.map((c) => c.label)).toEqual([
      'Campaign',
      'Type',
      'Audience',
      'Status',
      'Occasion',
      'Starts',
      'Ends',
      'Members',
      'Converted',
    ])
  })

  it('renders dates as dates and statuses as badges', () => {
    const byField = Object.fromEntries(campaignListConfig.columns.map((c) => [c.field, c]))
    expect(byField.start_date.renderType).toBe('date')
    expect(byField.end_date.renderType).toBe('date')
    expect(byField.status.renderType).toBe('badge')
    expect(byField.audience.renderType).toBe('badge')
  })
})
