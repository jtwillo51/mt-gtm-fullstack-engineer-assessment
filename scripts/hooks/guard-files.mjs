#!/usr/bin/env node
/**
 * Claude Code PreToolUse hook (Edit | Write | MultiEdit | NotebookEdit).
 *
 * Turns "please don't" conventions into hard stops. Exit 2 blocks the tool
 * call and feeds stderr back to Claude, which then takes the right path:
 *
 *   - supabase/migrations/* already on the base branch → forward-only: write a
 *     NEW migration instead (an edited applied migration never re-runs, so
 *     local, CI and prod schemas silently diverge).
 *   - src/types/database.generated.ts → regenerate with `npm run db:types`.
 *   - package-lock.json → change dependencies with npm, not by hand.
 *   - .env / .env.local / … (secrets) → ask the human. .env.example is fine.
 *
 * A new migration on your own branch stays editable until it reaches main.
 */
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * @param {string} rel  repo-relative path, forward slashes
 * @param {{ onBaseBranch: (rel: string) => boolean }} repo
 * @returns {string | null} why the edit is blocked, or null to allow it
 */
export function blockReason(rel, repo) {
  if (rel.startsWith('../') || path.isAbsolute(rel)) return null // outside the repo

  if (/^supabase\/migrations\/.+\.sql$/.test(rel) && repo.onBaseBranch(rel)) {
    return (
      `${rel} is already on the base branch, and migrations are forward-only. ` +
      'Write a new migration (next NNNN_ number) that alters what you need instead.'
    )
  }
  if (rel === 'src/types/database.generated.ts') {
    return `${rel} is generated. Change the migration, then run \`npm run db:types\`.`
  }
  if (rel === 'package-lock.json') {
    return 'package-lock.json is managed by npm. Use `npm install <pkg>` / `npm uninstall <pkg>`.'
  }
  const base = path.posix.basename(rel)
  if (/^\.env(\..+)?$/.test(base) && base !== '.env.example') {
    return `${rel} holds local secrets. Ask the user to change it; document new keys in .env.example.`
  }
  return null
}

function onBaseBranch(root) {
  const base = ['origin/main', 'main'].find((ref) => {
    try {
      execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: root, stdio: 'ignore' })
      return true
    } catch {
      return false
    }
  })
  return (rel) => {
    if (!base) return false
    try {
      execFileSync('git', ['cat-file', '-e', `${base}:${rel}`], { cwd: root, stdio: 'ignore' })
      return true
    } catch {
      return false
    }
  }
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
  let input = ''
  for await (const chunk of process.stdin) input += chunk
  let filePath
  try {
    const event = JSON.parse(input || '{}')
    filePath = event.tool_input?.file_path ?? event.tool_input?.notebook_path
  } catch {
    process.exit(0) // not hook JSON — never block on our own parse failure
  }
  if (!filePath) process.exit(0)

  const rel = path.relative(root, path.resolve(root, filePath)).split(path.sep).join('/')
  const reason = blockReason(rel, { onBaseBranch: onBaseBranch(root) })
  if (reason) {
    console.error(`Blocked by scripts/hooks/guard-files.mjs: ${reason}`)
    process.exit(2)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
