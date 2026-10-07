---
paths:
  - 'supabase/**/*.sql'
---

# Migrations

- **Forward-only.** A migration already on `main` is never edited (the guard hook blocks
  it). Change schema with a new file: next `NNNN_snake_case.sql` number, no gaps.
- **Copy the shape of `0002_companies.sql`** for a business table:
  1. Columns, then the audit block exactly: `owner_id, created_at, created_by,
updated_at, updated_by, deleted_at, deleted_by`.
  2. `idx_<table>_live` partial index `WHERE deleted_at IS NULL`, plus an index on
     every FK column (the conventions test checks FK indexes).
  3. `CREATE TRIGGER audit_<table>_fields BEFORE INSERT OR UPDATE … handle_audit_fields()`.
  4. `ENABLE ROW LEVEL SECURITY` + the four permissive policies (select with the
     editor/admin soft-delete bypass, editor insert, owner-or-admin update, admin
     delete) + the RESTRICTIVE `<table>_active_app_membership` gate.
  5. `GRANT SELECT, INSERT, UPDATE, DELETE … TO authenticated`.
- **Views:** `ALTER VIEW … SET (security_invoker = true)` right after `CREATE VIEW`.
  `DROP VIEW` loses it, so re-apply it after any re-create.
- **Option lists** (`CHECK (x IN (…))`) must match the Zod list in
  `src/lib/schemas/`. Same values, same order.
- **Uniqueness with soft delete:** partial unique indexes `WHERE deleted_at IS NULL`, so a
  removed row can be re-added.
- **Join/child tables:** add them to `cleanupTestDataByOwner` in
  `src/__tests__/utils/seed-helpers.ts`, before their parents.

After writing one:

```bash
npx supabase migration up        # apply locally without wiping data
npm run db:types                 # regenerate + commit src/types/database.generated.ts
npm run test:integration         # includes db-conventions.test.ts
```

Ask the `db-reviewer` agent to review it before you build services on top.
