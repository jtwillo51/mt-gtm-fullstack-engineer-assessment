/**
 * Safe free-text search for list services.
 *
 * User input must never be spliced raw into a PostgREST `.or()` filter string:
 * a comma or parenthesis breaks the parse ("Smith, John" → 400 → page crash),
 * and crafted input can append its own filter conditions. Every term here is
 * LIKE-escaped (so % and _ match literally) and double-quoted for PostgREST.
 */

const BACKSLASH = '\\'

/** Escape LIKE wildcards so the term matches literally. */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (ch) => BACKSLASH + ch)
}

/** Quote a value for a PostgREST logic-tree filter (`.or()`). */
export function quotePostgrestValue(value: string): string {
  return `"${value.replace(/[\\"]/g, (ch) => BACKSLASH + ch)}"`
}

/**
 * The `.or()` filter for a search: the (trimmed) search text must appear,
 * case-insensitive substring, in at least one of `fields`. Same matching the
 * list pages always had; only the escaping is new. Null when there's nothing
 * to filter on.
 */
export function buildSearchFilter(
  fields: readonly string[],
  search: string | undefined
): string | null {
  const term = (search ?? '').trim()
  if (!term || fields.length === 0) return null
  const pattern = quotePostgrestValue(`%${escapeLike(term)}%`)
  return fields.map((f) => `${f}.ilike.${pattern}`).join(',')
}

/** Apply `buildSearchFilter` to a PostgREST query builder. */
export function applySearch<Q extends { or: (filters: string) => Q }>(
  query: Q,
  fields: readonly string[],
  search: string | undefined
): Q {
  const filter = buildSearchFilter(fields, search)
  return filter ? query.or(filter) : query
}
