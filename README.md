# Atlas Mini CRM — Full-Stack Engineer Assessment

A small, self-contained CRM built with the stack and conventions we use day to
day: **Next.js 15 (App Router) · TypeScript · Supabase (Postgres + Auth + RLS) ·
Zod · React Query**.

It ships with two working reference models — **Companies** and **Contacts** —
built across every layer (database migration → service → schema → actions →
config-driven list/form/detail). This repo is standalone; you don't need access
to anything else.

---

## Your task

Add a feature to track **marketing campaigns** — including which companiesand people were part of each campaign — so we can understand how our marketing is performing.
Campaigns might be things like email, direct mail, etc.

Build it in a way that's **consistent with how the rest of the project is
built**. The data model, what a campaign tracks, and how it shows up in the UI
are your calls — we're interested in your approach, not in matching a spec.

- You're welcome to use coding agents (Copilot, Cursor, Claude, etc.).
- Add a short **`APPROACH.md`** to the repo describing how you approached the
  work — the key decisions you made and the tools you used.

Aim for a few hours of work at the most. It's fine to leave notes on what you'd do next rather than
polish everything.

---

## Getting started

**Prerequisites:** Node 22+, Docker (running), and the
[Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
npm install
supabase start                 # prints your API URL + keys
cp .env.example .env.local     # paste the anon + service_role keys from `supabase start`
npm run db:reset               # apply migrations + seed
npm run dev                    # http://localhost:3000
```

Sign in with any seeded user (password `password123`):
`admin@example.com` · `editor@example.com` · `viewer@example.com` — the role
controls what you can edit. Supabase Studio is at http://localhost:54323.

### Commands

```bash
npm run dev            # dev server
npm run build          # production build (also the type gate)
npm run lint           # ESLint        (npm run format to auto-format)
npm run test           # tests (test:unit = no DB; test:integration needs the stack)
npm run verify         # format:check → lint → build → test
npm run db:reset       # re-apply migrations + seed
npm run db:types       # regenerate Supabase types after a schema change
```

---

## How the project is organized

Trace **Companies** (a base model) and **Contacts** (a model with a company FK,
shown as a child table on the company detail page) end to end before you start —
they're the pattern to follow.

```
supabase/migrations/        SQL: tables, audit fields, RLS, triggers, views
src/lib/services/           business logic — the single source of truth
src/lib/schemas/            Zod: create schema + .partial() update + z.input types
src/lib/actions/ + src/actions/   createCRUDActions factory + thin 'use server' files
src/lib/config/models/      field + column config that drives forms AND tables
src/components/              DataTable, config form renderer, form sheet, buttons
src/app/(dashboard)/        Server Component pages: fetch via a service, pass data down
src/lib/services/*.test.ts  co-located DB-backed tests
```

Conventions worth matching:

- Business logic lives in **services**; actions/pages validate and call them.
- **Soft-delete** (`deleted_at`), standard **audit fields**, and **RLS** on every
  table (the reference models show the policy shape). Migrations are forward-only.
- UI is **config-driven** — add a field to the config rather than bespoke JSX.
- Don't pass functions or React components across the **Server → Client boundary**.

---

## Submitting

Fork this repository to your own GitHub account, do your work on the fork, and
share it with **@jmhollinger** (add them as a collaborator, or make your fork
public and send the link). Make sure `APPROACH.md` is included.
