# Copilot instructions

The project guide for every coding agent is [`AGENTS.md`](../AGENTS.md) at the repo root:
commands, the layer order (migration → types → schema → service → action → config →
UI), the gotchas, and the testing rules. Per-layer detail is in `.claude/rules/*.md`
(plain Markdown), and the add-a-model checklist is `.claude/skills/add-model/SKILL.md`.

The rules that matter most:

- Business logic lives in `src/lib/services/`; actions validate with `validate()` and
  call a service. Pages are Server Components that pass plain data to client components.
- Never splice user input into a PostgREST filter string; use `applySearch()`.
- Migrations are forward-only and follow `0002_companies.sql` (audit block, trigger,
  RLS + restrictive gate, `security_invoker` views). `db-conventions.test.ts` enforces it.
- Regenerate `src/types/database.generated.ts` with `npm run db:types`; never hand-edit.
- Every feature ships with tests (`npm run check:tests`); run `npm run verify` before a PR.
