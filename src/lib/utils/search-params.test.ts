import { describe, expect, it } from 'vitest'
import { parseSearchParams } from './search-params'
import { campaignListConfig } from '@/lib/config/models/campaign-config'

const config = campaignListConfig

describe('parseSearchParams', () => {
  it('defaults to page 1 of 25 and leaves sort direction to the service', () => {
    expect(parseSearchParams({}, config)).toEqual({
      limit: 25,
      offset: 0,
      orderBy: undefined,
      orderAsc: undefined,
      search: undefined,
    })
  })

  it('computes the offset from page and limit', () => {
    expect(parseSearchParams({ page: '3', limit: '10' }, config)).toMatchObject({
      limit: 10,
      offset: 20,
    })
  })

  it.each(['0', '-2', '1.5', 'abc', ''])('ignores an invalid page %j', (page) => {
    expect(parseSearchParams({ page }, config).offset).toBe(0)
  })

  it.each(['0', '-5', 'abc'])('ignores an invalid limit %j', (limit) => {
    expect(parseSearchParams({ limit }, config).limit).toBe(25)
  })

  it('keeps orderBy only for a sortable column', () => {
    expect(parseSearchParams({ orderBy: 'name' }, config).orderBy).toBe('name')
    // Visible but not sortable.
    expect(parseSearchParams({ orderBy: 'occasion' }, config).orderBy).toBeUndefined()
    // Not a column at all — would 400 in PostgREST.
    expect(parseSearchParams({ orderBy: 'bogus' }, config).orderBy).toBeUndefined()
    expect(parseSearchParams({ orderBy: 'name;drop' }, config).orderBy).toBeUndefined()
  })

  it('parses the sort direction', () => {
    expect(parseSearchParams({ asc: 'true' }, config).orderAsc).toBe(true)
    expect(parseSearchParams({ asc: 'false' }, config).orderAsc).toBe(false)
  })

  it('trims the search and drops a blank one', () => {
    expect(parseSearchParams({ search: '  July ' }, config).search).toBe('July')
    expect(parseSearchParams({ search: '   ' }, config).search).toBeUndefined()
  })

  it('takes the first value of a repeated param', () => {
    expect(parseSearchParams({ search: ['a', 'b'] }, config).search).toBe('a')
  })
})
