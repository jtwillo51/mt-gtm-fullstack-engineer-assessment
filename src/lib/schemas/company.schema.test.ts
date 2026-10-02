import { describe, expect, it } from 'vitest'
import { companySchema, companyUpdateSchema } from './company.schema'

describe('companySchema', () => {
  it('requires a name', () => {
    const result = companySchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('normalizes empty optional strings to null', () => {
    const parsed = companySchema.parse({ name: 'Acme', website: '', industry: undefined })
    expect(parsed.website).toBeNull()
    expect(parsed.industry).toBeNull()
  })

  it('keeps provided optional values', () => {
    const parsed = companySchema.parse({ name: 'Acme', website: 'https://acme.test' })
    expect(parsed.website).toBe('https://acme.test')
  })

  it('update schema makes every field optional', () => {
    const result = companyUpdateSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})
