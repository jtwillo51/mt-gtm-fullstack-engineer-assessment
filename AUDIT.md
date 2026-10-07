# Notes from working in the codebase

While building campaigns I kept a list of what I noticed outside the feature. I kept
this submission's code changes to the campaign feature and the shared code it depends on.
**The Companies and Contacts pages are unchanged**, with one exception: their search
shares the service fix below, so a search containing a comma now returns results
instead of an error. Everything else is written up below as a suggestion. I confirmed
each item against the running app or database before writing it down.

## Fixed, because campaigns depend on it

| Issue                                                                                                                                                                                | Fix                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| List search put the search text directly into a PostgREST `.or()` filter, so a comma (`Smith, John`) returned a 400. The campaign member picker uses the company and contact search. | `services/search.ts` escapes and quotes the search text. Fields and matching are unchanged.                                                              |
| A bad `?orderBy=` or a malformed id threw a Postgres error and showed Next's default error screen.                                                                                   | Campaign pages whitelist `orderBy` to sortable columns, return 404 for malformed ids, and have their own `error.tsx` / `not-found.tsx`.                  |
| The CRUD action factory used `.parse()`, so invalid input surfaced as raw ZodError JSON in a toast.                                                                                  | A shared `validate()` returns the first readable message. The factory and the campaign actions use it.                                                   |
| With the reference RLS shape, an editor couldn't record outcomes for members someone else added to their own campaign, and all seeded campaigns belonged to the admin.               | The campaign owner can manage its members and artifacts (`0006`). Controls are hidden where RLS would refuse. The editor owns two of the demo campaigns. |
| Company industry is free text, so "Add all target-industry companies" missed `salon` vs `Salon`.                                                                                     | The bulk add matches case-insensitively. (Unifying the lists is below.)                                                                                  |

## Suggestions for the existing pages (not changed)

- **One industry list.** Campaign targeting uses a fixed list while company industry is
  free text ("e.g. Beauty, Fitness"). Making company industry a select from the same list,
  with a DB `CHECK`, would make targeting exact.
- **Company website is rendered as a link without validation.** React 19 blocks
  `javascript:` URLs, but any other string becomes a link. An http(s) check in
  `company.schema.ts` (like campaign links have) would close it. Contact email is also
  unvalidated.
- **Error handling on Companies and Contacts.** The same `orderBy` and malformed-id
  crashes exist there. The campaign pages' approach (whitelist + `isUuid` + route error
  pages) would carry over directly.
- **Descriptive search placeholders.** List configs can now set `searchPlaceholder`;
  Companies and Contacts still say "Search…".
- **The company page's contacts table shows a search box** the page never reads.
- **There's no Delete in the UI** for companies or contacts. The actions exist.
- **`createContactForCompanyAction`** still uses `.parse()`, so it throws on invalid input
  instead of returning an error.
- **The login page pre-fills the admin credentials** in every environment. It could be
  limited to local development.
- **Dependency advisory:** `npm audit` flags the postcss bundled inside Next 15.5. The fix
  is Next 16, which deserves its own PR.

I have fixes for most of these implemented and tested on a separate branch, ready to
share if useful.

## Guardrails added for future work

- **`AGENTS.md`:** one project guide for any coding agent (Claude Code, Cursor, Copilot).
  `CLAUDE.md` adds the Claude-specific parts.
- **`db-conventions.test.ts`:** reads the Postgres catalog and fails if a table is missing
  RLS, the audit block and trigger, the standard policies, or FK indexes, or if a view
  isn't `security_invoker`. (I broke it on purpose once to confirm it catches each case.)
- **Generated DB types** (`npm run db:types`) with typed Supabase clients, plus a CI check
  that they're up to date.
- **`check-tests.mjs`:** feature changes must come with tests (CI job + Claude Code hook).
- **Claude Code hooks:** block edits to migrations already on `main`, the generated types
  and `.env*`; format and lint each edited file. Plus path-scoped rules, an `/add-model`
  checklist and a migration-review agent.
- **`.gitattributes`:** checkouts with Windows line endings failed `format:check` on every
  file. It now pins LF.
