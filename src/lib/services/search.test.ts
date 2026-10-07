import { describe, expect, it } from 'vitest'
import { applySearch, buildSearchFilter, escapeLike, quotePostgrestValue } from './search'

const B = '\\'

describe('escapeLike', () => {
  it.each([
    ['plain', 'plain'],
    ['100%', `100${B}%`],
    ['a_b', `a${B}_b`],
    [`a${B}b`, `a${B}${B}b`],
  ])('%s → %s', (input, expected) => {
    expect(escapeLike(input)).toBe(expected)
  })
})

describe('quotePostgrestValue', () => {
  it('wraps in double quotes so commas and parentheses are literal', () => {
    expect(quotePostgrestValue('Smith, John (Bayshore)')).toBe('"Smith, John (Bayshore)"')
  })

  it('escapes embedded quotes and backslashes', () => {
    expect(quotePostgrestValue(`a"b${B}c`)).toBe(`"a${B}"b${B}${B}c"`)
  })
})

describe('buildSearchFilter', () => {
  it.each([undefined, '', '   '])('returns null for an empty search (%j)', (search) => {
    expect(buildSearchFilter(['name'], search)).toBeNull()
  })

  it('returns null when the list has no search fields', () => {
    expect(buildSearchFilter([], 'Lena')).toBeNull()
  })

  it('matches the trimmed text as one term across every field', () => {
    expect(buildSearchFilter(['first_name', 'last_name'], '  Lena ')).toBe(
      'first_name.ilike."%Lena%",last_name.ilike."%Lena%"'
    )
  })

  it('keeps commas inside the quoted value (no filter injection)', () => {
    // One condition only: the injected ",id.not.is.null" stays inside the quotes.
    // The LIKE escape for % is itself backslash-escaped by the quoting.
    expect(buildSearchFilter(['name'], 'x%,id.not.is.null')).toBe(
      `name.ilike."%x${B}${B}%,id.not.is.null%"`
    )
  })
})

describe('applySearch', () => {
  it('adds one .or() filter for a search', () => {
    const calls: string[] = []
    const query = {
      or(filter: string) {
        calls.push(filter)
        return query
      },
    }
    expect(applySearch(query, ['name', 'occasion'], 'July sale')).toBe(query)
    expect(calls).toEqual(['name.ilike."%July sale%",occasion.ilike."%July sale%"'])
  })

  it('leaves the query untouched for a blank search', () => {
    const query = { or: () => query }
    expect(applySearch(query, ['name'], '  ')).toBe(query)
  })
})
