@AGENTS.md

# Claude Code specifics

The project guide above is shared with every coding agent. This part covers the
Claude Code tooling in `.claude/`.

## Hooks (`.claude/settings.json`), so you don't have to remember

| Event                    | Script                          | Effect                                                                                                                         |
| ------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| PreToolUse (Edit/Write)  | `scripts/hooks/guard-files.mjs` | **Blocks** edits to migrations already on `main` (write a new one), generated types, `package-lock.json`, and `.env*` secrets. |
| PostToolUse (Edit/Write) | `scripts/hooks/format-file.mjs` | Prettier + `eslint --fix` on the edited file; remaining lint errors come back to you.                                          |
| Stop                     | `scripts/check-tests.mjs`       | Blocks finishing if feature code changed without the tests the rules require.                                                  |

If a hook blocks you, its message says what to do instead. Don't work around it
(e.g. `sed` on an applied migration); the rule is there for a reason.

## Path-scoped rules (`.claude/rules/`)

Loaded only when you touch matching files: `migrations.md`, `services.md`,
`schemas-and-config.md`, `ui.md`, `testing.md`. Read the relevant one before writing
a new file in that layer.

## Skills and agents

- `/add-model` (`.claude/skills/add-model/`): the end-to-end checklist for a new model.
- `db-reviewer` agent (`.claude/agents/`): reviews a migration against the conventions
  before you apply it. Use it for any new migration.

## Verifying UI changes

`.claude/launch.json` defines the dev server for the preview browser. Sign in as
`editor@example.com` and as `viewer@example.com`: role gating is part of most UI changes.
