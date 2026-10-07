# Atlas Mini CRM: guide for coding agents (and humans)

Next.js 15 (App Router) · TypeScript · Supabase (Postgres + Auth + RLS + Storage) ·
Zod 4 · React Query · Tailwind 4 · Vitest. Models: **Companies**, **Contacts**
(many-to-many via `contact_companies`), **Campaigns** (members + artifacts). Setup is
in `README.md`; the campaigns design is in `APPROACH.md`.

This file is tool-agnostic (Claude Code, Cursor, Copilot and Codex all read it). Claude
Code extras (hooks, skills, path-scoped rules) are in `CLAUDE.md` and `.claude/`.

## Commands

```bash
npm run dev               # http://localhost:3000 (needs the local Supabase stack)
npx supabase start        # local stack via Docker (the CLI is a pinned devDependency)
npx supabase migration up # apply new migrations without wiping data
npm run db:reset          # re-apply all migrations + seed (wipes local data)
npm run db:types          # regenerate src/types/database.generated.ts after a migration
npm run test:unit         # jsdom, no DB
npm run test:integration  # real local Supabase + RLS (incl. DB convention checks)
npm run check:tests       # the test-requirement check (also a Stop hook + CI job)
npm run verify            # format:check → lint → build → test → check:tests
```

Seeded logins (local only): `admin@` / `editor@` / `viewer@example.com`, password
`password123`. The editor owns two of the demo campaigns; the admin owns the rest.

## Architecture: build in this layer order

| Layer     | Path                                          | Rule                                                                                                                                 |
| --------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Migration | `supabase/migrations/NNNN_*.sql`              | Forward-only. Audit block + `handle_audit_fields` trigger, soft delete, 4 RLS policies + restrictive gate, `security_invoker` views. |
| Types     | `src/types/database.generated.ts`             | Generated (`npm run db:types`), never hand-edited. CI fails if stale.                                                                |
| Schema    | `src/lib/schemas/*.schema.ts`                 | Zod create schema + `.partial()` update. Option lists live here and are mirrored by DB `CHECK`s.                                     |
| Service   | `src/lib/services/*.ts`                       | All business logic. Reads throw; mutations return `ActionResult`. Optional `ServiceContext`.                                         |
| Action    | `src/actions/*.ts`                            | Thin `'use server'`: `validate()` → service. CRUD via `createCRUDActions`.                                                           |
| Config    | `src/lib/config/models/*-config.ts`           | Fields + sections + list columns drive the form, detail view and table. Add a field here, not bespoke JSX.                           |
| UI        | `src/components/**`, `src/app/(dashboard)/**` | Server Component pages fetch via services and pass **plain data** to client components. No functions/components across the boundary. |

Adding a whole model touches ~15 files in that order. Follow the checklist in
`.claude/skills/add-model/SKILL.md` (plain Markdown, usable from any tool).

## Gotchas (each one has come up in this codebase)

- **Never put user text directly into a PostgREST filter string** (`.or()`): a comma
  breaks the parse and input can add conditions. Use `applySearch()` from
  `services/search.ts`; the fields come from the list config's `searchFields`.
- **URL params are user input.** Pass the list config to `parseSearchParams(sp, config)`
  so `orderBy` is limited to sortable columns. In a `get*` service, return `null` for a
  malformed id (`isUuid`) so a bad link is a 404 and not a Postgres error.
- **Zod 4 applies `.default()` inside `.partial()`.** Defaults go on the create schema
  only, never the shared base (see `campaign.schema.ts`).
- **Thrown ZodErrors stringify to JSON.** Actions use `validate()` from
  `src/lib/actions/validate.ts` (the CRUD factory already does).
- **User-supplied URLs rendered as `href`** must be restricted to http(s)
  (`z.url({ protocol: /^https?$/ })`).
- **DATE columns:** `formatDateOnly`, never `new Date('YYYY-MM-DD')` (UTC → previous day).
- **Ownership:** the reference RLS update policy is owner-or-admin. For campaigns,
  `0006_campaign_access.sql` also lets the **campaign owner** manage members and
  artifacts others added, and the detail page hides controls via
  `canManageCampaign()`. Deletes are soft (`deleted_at`).
- **Campaign stats are derived** from member outcomes in `v_campaigns`. Never store them.
- **Company industry is free text** while campaign target industries are a fixed list,
  so the bulk add matches case-insensitively. Unifying them is a noted follow-up.

## Testing rules (enforced by `scripts/check-tests.mjs` + CI)

1. Feature code changed → at least one test changed in the same diff.
2. New service / schema / config model / component → a co-located `*.test.ts(x)`.
3. New migration → a DB-backed service test changed.
4. A test that touches the DB must be listed in `DB_BACKED_TESTS` in `vitest.config.ts`.

Also enforced automatically:

- `src/lib/services/db-conventions.test.ts` reads the Postgres catalog: every public
  table has RLS; every business table has the audit block, audit trigger, all four
  permissive policies, the restrictive active-user gate and indexed FKs; every view is
  `security_invoker`; migrations are numbered sequentially.
- `campaign-shape.test.ts` has compile-time checks that the row interfaces match the
  generated view types.

Per-layer guidance (what to assert, how to mock) is in `.claude/rules/testing.md`.

## CI (`.github/workflows/ci.yml`)

PRs into `main` must be up to date with `main`, merge cleanly, and pass format, lint,
typecheck, build, unit tests, `check:tests`, generated-types freshness, and integration
tests against a fresh local Supabase.
