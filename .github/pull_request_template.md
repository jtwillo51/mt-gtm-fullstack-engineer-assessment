## What and why

<!-- The user-facing change and the reason. Link the issue if there is one. -->

## Decisions worth a second look

<!-- Product or design calls you made, trade-offs, anything a reviewer might disagree with. -->

## How I verified it

- [ ] `npm run verify` passes locally (format, lint, build, unit + integration tests, check:tests)
- [ ] Clicked through as **editor** and as **viewer**
- [ ] Tried the unhappy paths (empty states, validation errors, a search with a comma)

## Checklist

- [ ] New migration? Forward-only, follows `0002_companies.sql`, reviewed with the
      `db-reviewer` agent, and `src/types/database.generated.ts` regenerated
- [ ] New option list? Zod list and DB `CHECK` match
- [ ] New table touched by tests? Added to `cleanupTestDataByOwner` (children first)
      and the test file to `DB_BACKED_TESTS`
- [ ] Docs updated if a convention changed (`AGENTS.md`, `.claude/rules/`)

## Screenshots

<!-- Before/after for UI changes. -->
