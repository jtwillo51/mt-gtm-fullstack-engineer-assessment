import type { ListOptions } from '@/lib/services/base'
import type { ListViewConfig } from '@/lib/config/types'

export type RawSearchParams = Record<string, string | string[] | undefined>

/**
 * Parse list-page URL params into ListOptions.
 *
 * The URL is user input, so nothing reaches the query unchecked:
 *  - with a list config, `orderBy` is kept only if that column is sortable
 *    (an unknown column would make PostgREST 400 and crash the page);
 *  - `page` / `limit` must be positive integers.
 * `orderAsc` is left UNDEFINED when the param is absent, so each service's own
 * default direction applies (never fabricate a boolean here).
 */
export function parseSearchParams(
  sp: RawSearchParams,
  config?: Pick<ListViewConfig, 'columns'>
): ListOptions {
  const str = (key: string): string | undefined => {
    const v = sp[key]
    return Array.isArray(v) ? v[0] : v
  }
  const positiveInt = (key: string): number | undefined => {
    const n = Number(str(key))
    return Number.isInteger(n) && n >= 1 ? n : undefined
  }

  const page = positiveInt('page') ?? 1
  const limit = positiveInt('limit') ?? 25
  const asc = str('asc')
  const orderBy = str('orderBy')
  const sortable = config && new Set(config.columns.filter((c) => c.sortable).map((c) => c.field))

  return {
    limit,
    offset: (page - 1) * limit,
    orderBy: sortable && orderBy && !sortable.has(orderBy) ? undefined : orderBy,
    orderAsc: asc === undefined ? undefined : asc === 'true',
    search: str('search')?.trim() || undefined,
  }
}
