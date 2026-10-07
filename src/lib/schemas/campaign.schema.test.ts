import { describe, expect, it } from 'vitest'
import {
  CAMPAIGN_AUDIENCES,
  CAMPAIGN_INDUSTRIES,
  CAMPAIGN_MEMBER_STATUSES,
  CAMPAIGN_STATUSES,
  CAMPAIGN_TYPES,
  campaignFileArtifactSchema,
  campaignLinkArtifactSchema,
  campaignMemberStatusSchema,
  campaignSchema,
  campaignUpdateSchema,
} from './campaign.schema'

/**
 * Every input the campaign UI accepts is validated here, field by field:
 * the campaign form, the link + file artifact inputs, and the member outcome
 * select. Option lists are also pinned, because the DB CHECK constraints in
 * 0005_campaigns.sql mirror them — changing one without the other breaks writes.
 */

const valid = { name: 'July Promo', type: 'Email', audience: 'External' } as const

const accepts = (input: Record<string, unknown>) => campaignSchema.safeParse({ ...valid, ...input })

// ---------------------------------------------------------------------------
// Option lists (mirrored by DB CHECK constraints)
// ---------------------------------------------------------------------------
describe('option lists', () => {
  it('pins the campaign types, statuses, audiences, industries and outcomes', () => {
    expect(CAMPAIGN_TYPES).toEqual(['Email', 'Direct Mail', 'SMS', 'Social', 'Event', 'Other'])
    expect(CAMPAIGN_STATUSES).toEqual(['Draft', 'Active', 'Completed'])
    expect(CAMPAIGN_AUDIENCES).toEqual(['Internal', 'External'])
    expect(CAMPAIGN_INDUSTRIES).toEqual([
      'Salon',
      'Spa',
      'Med Spa',
      'Massage',
      'Nail Salon',
      'Barbershop',
      'Lash & Brow',
      'Wellness',
      'Tattoo Studio',
    ])
    expect(CAMPAIGN_MEMBER_STATUSES).toEqual([
      'Targeted',
      'Sent',
      'Opened',
      'Responded',
      'Converted',
      'Bounced',
    ])
  })
})

// ---------------------------------------------------------------------------
// Data shape
// ---------------------------------------------------------------------------
describe('campaignSchema output shape', () => {
  it('produces exactly the writable campaign columns', () => {
    const parsed = campaignSchema.parse(valid)
    expect(Object.keys(parsed).sort()).toEqual(
      [
        'audience',
        'end_date',
        'name',
        'occasion',
        'purpose',
        'start_date',
        'status',
        'target_industries',
        'type',
      ].sort()
    )
  })

  it('strips audit, ownership and id fields so a client cannot set them', () => {
    const parsed = campaignSchema.parse({
      ...valid,
      id: '00000000-0000-0000-0000-000000000000',
      owner_id: 'someone-else',
      created_by: 'someone-else',
      deleted_at: '2026-01-01',
    }) as Record<string, unknown>
    for (const key of ['id', 'owner_id', 'created_by', 'deleted_at']) {
      expect(parsed).not.toHaveProperty(key)
    }
  })
})

// ---------------------------------------------------------------------------
// Campaign form inputs
// ---------------------------------------------------------------------------
describe('name', () => {
  it.each([
    ['a normal name', 'Summer Booking Boost', true],
    ['a single character', 'X', true],
    ['an empty string', '', false],
    ['a non-string', 42, false],
  ])('%s → %s', (_label, name, ok) => {
    expect(accepts({ name }).success).toBe(ok)
  })

  it('is required', () => {
    const { name: _omit, ...rest } = valid
    void _omit
    expect(campaignSchema.safeParse(rest).success).toBe(false)
  })

  it('reports a readable message', () => {
    const result = accepts({ name: '' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].message).toBe('Campaign name is required')
  })
})

describe('type', () => {
  it.each(CAMPAIGN_TYPES)('accepts %s', (type) => {
    expect(accepts({ type }).success).toBe(true)
  })

  it.each(['', 'email', 'Pigeon', null])('rejects %j', (type) => {
    expect(accepts({ type }).success).toBe(false)
  })
})

describe('audience', () => {
  it.each(CAMPAIGN_AUDIENCES)('accepts %s', (audience) => {
    expect(accepts({ audience }).success).toBe(true)
  })

  it.each(['', 'internal', 'Both', undefined])('rejects %j', (audience) => {
    expect(accepts({ audience }).success).toBe(false)
  })
})

describe('status', () => {
  it.each(CAMPAIGN_STATUSES)('accepts %s', (status) => {
    expect(accepts({ status }).success).toBe(true)
  })

  it('defaults to Draft on create', () => {
    expect(campaignSchema.parse(valid).status).toBe('Draft')
  })

  it.each(['', 'Paused', 'draft'])('rejects %j', (status) => {
    expect(accepts({ status }).success).toBe(false)
  })
})

describe.each(['occasion', 'purpose'])('%s (optional text)', (field) => {
  it('keeps provided text', () => {
    const parsed = campaignSchema.parse({ ...valid, [field]: '4th of July Sale' })
    expect(parsed[field as 'occasion']).toBe('4th of July Sale')
  })

  it.each([
    ['blank', ''],
    ['omitted', undefined],
    ['null', null],
  ])('normalizes %s to null', (_label, value) => {
    const parsed = campaignSchema.parse({ ...valid, [field]: value })
    expect(parsed[field as 'occasion']).toBeNull()
  })

  it('rejects a non-string', () => {
    expect(accepts({ [field]: 7 }).success).toBe(false)
  })
})

describe('target_industries', () => {
  it.each(CAMPAIGN_INDUSTRIES)('accepts %s', (industry) => {
    expect(accepts({ target_industries: [industry] }).success).toBe(true)
  })

  it('accepts several at once and keeps their order', () => {
    const parsed = campaignSchema.parse({ ...valid, target_industries: ['Spa', 'Salon'] })
    expect(parsed.target_industries).toEqual(['Spa', 'Salon'])
  })

  it('defaults to an empty list on create', () => {
    expect(campaignSchema.parse(valid).target_industries).toEqual([])
  })

  it.each([
    ['an unknown industry', ['Bakery']],
    ['a lowercase option', ['salon']],
    ['a bare string instead of a list', 'Salon'],
  ])('rejects %s', (_label, target_industries) => {
    expect(accepts({ target_industries }).success).toBe(false)
  })
})

describe.each(['start_date', 'end_date'])('%s', (field) => {
  it('keeps a YYYY-MM-DD date', () => {
    const parsed = campaignSchema.parse({ ...valid, [field]: '2026-07-04' })
    expect(parsed[field as 'start_date']).toBe('2026-07-04')
  })

  it('normalizes a blank date input to null', () => {
    const parsed = campaignSchema.parse({ ...valid, [field]: '' })
    expect(parsed[field as 'start_date']).toBeNull()
  })
})

describe('date range', () => {
  it.each([
    ['end after start', '2026-07-01', '2026-07-10', true],
    ['same day', '2026-07-04', '2026-07-04', true],
    ['only a start', '2026-07-04', '', true],
    ['only an end', '', '2026-07-04', true],
    ['end before start', '2026-07-10', '2026-07-01', false],
  ])('%s → %s', (_label, start_date, end_date, ok) => {
    expect(accepts({ start_date, end_date }).success).toBe(ok)
  })

  it('attaches the error to end_date', () => {
    const result = accepts({ start_date: '2026-07-10', end_date: '2026-07-01' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['end_date'])
      expect(result.error.issues[0].message).toBe('End date must be on or after the start date')
    }
  })

  it('also guards partial updates that send both dates', () => {
    expect(
      campaignUpdateSchema.safeParse({ start_date: '2026-07-10', end_date: '2026-07-01' }).success
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Updates
// ---------------------------------------------------------------------------
describe('campaignUpdateSchema', () => {
  it('makes every field optional', () => {
    expect(campaignUpdateSchema.safeParse({}).success).toBe(true)
  })

  it('returns only the fields that were sent', () => {
    expect(campaignUpdateSchema.parse({ name: 'Renamed' })).toEqual({ name: 'Renamed' })
  })

  it('does not inject create-time defaults into a partial update', () => {
    // Zod 4 applies .default() even inside .partial(); a default here would
    // silently reset status / industries on every partial update.
    const parsed = campaignUpdateSchema.parse({ name: 'Renamed' })
    expect(parsed.status).toBeUndefined()
    expect(parsed.target_industries).toBeUndefined()
  })

  it('still validates the fields it is given', () => {
    expect(campaignUpdateSchema.safeParse({ type: 'Pigeon' }).success).toBe(false)
    expect(campaignUpdateSchema.safeParse({ name: '' }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Artifact inputs
// ---------------------------------------------------------------------------
describe('campaignLinkArtifactSchema', () => {
  const link = { title: 'Flyer', url: 'https://cdn.example.com/flyer.png' }

  it('produces exactly { title, url }', () => {
    expect(campaignLinkArtifactSchema.parse({ ...link, extra: 1 })).toEqual(link)
  })

  it.each([
    ['https', 'https://cdn.example.com/flyer.png', true],
    ['http', 'http://example.com/email', true],
    ['javascript:', 'javascript:alert(1)', false],
    ['data:', 'data:text/html,<script>alert(1)</script>', false],
    ['ftp', 'ftp://example.com/file', false],
    ['mailto', 'mailto:a@b.com', false],
    ['not a URL', 'flyer.png', false],
    ['empty', '', false],
  ])('url: %s → %s', (_label, url, ok) => {
    expect(campaignLinkArtifactSchema.safeParse({ ...link, url }).success).toBe(ok)
  })

  it('requires a title', () => {
    expect(campaignLinkArtifactSchema.safeParse({ ...link, title: '' }).success).toBe(false)
  })
})

describe('campaignFileArtifactSchema', () => {
  const file = { title: 'july-email', storage_path: 'abc/123-july.png' }

  it('accepts the minimum and normalizes the optional fields', () => {
    const parsed = campaignFileArtifactSchema.parse(file)
    expect(parsed.mime_type).toBeNull()
    expect(parsed.size_bytes).toBeUndefined()
  })

  it('keeps mime type and size', () => {
    const parsed = campaignFileArtifactSchema.parse({
      ...file,
      mime_type: 'image/png',
      size_bytes: 19164,
    })
    expect(parsed).toMatchObject({ mime_type: 'image/png', size_bytes: 19164 })
  })

  it.each([
    ['an empty title', { title: '' }],
    ['an empty storage path', { storage_path: '' }],
    ['a negative size', { size_bytes: -1 }],
    ['a fractional size', { size_bytes: 1.5 }],
    ['a string size', { size_bytes: '100' }],
  ])('rejects %s', (_label, override) => {
    expect(campaignFileArtifactSchema.safeParse({ ...file, ...override }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Member outcome select
// ---------------------------------------------------------------------------
describe('campaignMemberStatusSchema', () => {
  it.each(CAMPAIGN_MEMBER_STATUSES)('accepts %s', (status) => {
    expect(campaignMemberStatusSchema.safeParse(status).success).toBe(true)
  })

  it.each(['', 'Clicked', 'converted', null])('rejects %j', (status) => {
    expect(campaignMemberStatusSchema.safeParse(status).success).toBe(false)
  })
})
