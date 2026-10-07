import { describe, expect, it } from 'vitest'
import { formatDateOnly } from './utils'

const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }

describe('formatDateOnly', () => {
  it('formats a DATE as that same local calendar day', () => {
    // new Date('2026-07-04') would be UTC midnight → July 3 in US timezones.
    expect(formatDateOnly('2026-07-04')).toBe(
      new Date(2026, 6, 4).toLocaleDateString(undefined, opts)
    )
  })

  it('ignores a time part', () => {
    expect(formatDateOnly('2026-07-04T23:59:00Z')).toBe(formatDateOnly('2026-07-04'))
  })

  it('returns unparseable input unchanged', () => {
    expect(formatDateOnly('not a date')).toBe('not a date')
  })
})
