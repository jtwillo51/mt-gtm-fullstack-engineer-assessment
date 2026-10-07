---
paths:
  - '**/*.test.ts'
  - '**/*.test.tsx'
  - '**/*.test.mjs'
  - 'vitest.config.ts'
  - 'src/__tests__/**'
---

# Testing

Two Vitest projects (`vitest.config.ts`): **unit** (jsdom, Supabase env pointed at an
unroutable host) and **integration** (node, real local Supabase). A test that touches
the DB **must** be listed in `DB_BACKED_TESTS`, or it fails confusingly in the unit
project. `check-tests.mjs` catches the common case.

What to write, by layer:

- **Schema:** table-driven accept/reject for **every input**, with the exact error
  message. Output shape (exact keys). Partial update omits untouched keys. Pin option
  lists.
- **Service (integration):** use `createIsolatedTestUsers()` + `createTestUserContext()`.
  Cover audit stamping, a viewer blocked by RLS, DB constraints (call the service with
  `as never` input to bypass Zod and prove the CHECK holds), soft delete, search with
  reserved characters (`,` `(` `"` `%`). Clean up with `cleanupTestDataByOwner` in
  `afterEach`.
- **Shape:** when a view changes, update `campaign-shape.test.ts` (runtime column list)
  and add a `SameKeys<Interface, Tables<'v_x'>>` compile-time check for new models.
- **Config:** form fields stay in lockstep with the schema shape (see
  `campaign-config.test.ts`).
- **Components:** Testing Library. Mock `next/navigation`, `sonner`, `@/actions/*` and
  `@/lib/supabase/client` with `vi.hoisted`. Wrap in `PermissionProvider` and test
  **editor and viewer**. Test the failure path (action returns `success: false` or
  rejects), not just the happy path.
- **Pure scripts** (`scripts/**`): export the decision function and unit test it with
  an in-memory fake (see `check-tests.test.mjs`, `hooks.test.mjs`).

Prove a new guard fails before trusting it: break the thing on purpose once and
watch the test go red.
