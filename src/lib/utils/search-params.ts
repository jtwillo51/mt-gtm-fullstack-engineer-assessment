import type { ListOptions } from '@/lib/services/base'

export type RawSearchParams = Record<string, string | string[] | undefined>

/**
 * Parse list-page URL params into ListOptions. `orderAsc` is left UNDEFINED
 * when the param is absent, so each service's own default direction applies
 * (never fabricate a boolean here).
 */
export function parseSearchParams(sp: RawSearchParams): ListOptions {
  const str = (key: string): string | undefined => {
    const v = sp[key]
    return Array.isArray(v) ? v[0] : v
  }
  const num = (key: string): number | undefined => {
    const v = str(key)
    if (v === undefined) return undefined
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }

  const page = num('page') ?? 1
  const limit = num('limit') ?? 25
  const asc = str('asc')

  return {
    limit,
    offset: (page - 1) * limit,
    orderBy: str('orderBy'),
    orderAsc: asc === undefined ? undefined : asc === 'true',
    search: str('search') || undefined,
  }
}
