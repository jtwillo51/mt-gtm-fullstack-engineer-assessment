---
paths:
  - 'src/lib/services/**/*.ts'
  - 'src/actions/**/*.ts'
  - 'src/lib/actions/**/*.ts'
---

# Services and actions

**Services** (`src/lib/services/`) hold all business logic. Conventions are in the header
of `base.ts`:

- Reads (`get*`, `list*`) return data and **throw** on DB error. `.single()` with no row
  (`PGRST116`) → `null`. A new `get*(id)` starts with `if (!isUuid(id)) return null`.
- Mutations return `ActionResult<T>`. Wrap the body in try/catch and use
  `getErrorMessage()`.
- Take an optional `ServiceContext` as the last argument (tests pass an RLS-scoped one).
- Stamp `created_by`/`updated_by` with `getUserId(ctx)`. Soft-delete with
  `deleted_at`/`deleted_by` and confirm with `.select()`; empty result → "Permission
  denied or <thing> not found".
- Read from the `v_*` view, filter `.is('deleted_at', null)`.
- **Search:** `query = applySearch(query, xListConfig.searchFields ?? [], options.search)`.
  Never interpolate user input into `.or()` / filter strings.
- **Sort:** the page has already whitelisted `orderBy` via `parseSearchParams`; always add
  a unique tiebreaker (`.order('id')`) for stable pagination.
- The client is typed (`DbClient`), so insert/update payloads are checked against
  the generated schema. Use `TablesUpdate<'x'>` for built-up payloads, not
  `Record<string, unknown>`.
- Pure derivations (stats, shaping) are exported functions with unit tests.

**Actions** (`src/actions/*.ts`) are thin `'use server'` files:

- CRUD → `createCRUDActions({ serviceName, schemas, service })`.
- Anything else: `const v = validate(schema, input); if (!v.ok) return v.error` then call
  the service. Never `schema.parse()` (a thrown ZodError's message is raw JSON).
- No business logic here. If you're writing an `if` about data, it goes in the service.
