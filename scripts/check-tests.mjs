#!/usr/bin/env node
/**
 * Enforces "every feature ships with tests".
 *
 * Usage:
 *   node scripts/check-tests.mjs                  # local: branch + uncommitted work vs main
 *   node scripts/check-tests.mjs --base origin/main   # CI: the PR's diff against its base
 *   node scripts/check-tests.mjs --hook           # Claude Code Stop hook (reads hook JSON on stdin)
 *
 * Rules (see findViolations):
 *   1. Feature code changed → at least one test file changed in the same diff.
 *   2. A NEW service, schema, config model or component → a co-located *.test.ts(x).
 *   3. A NEW migration → a DB-backed service test changed in the same diff.
 *   4. A changed test that talks to the DB (imports the RLS test helpers) must be
 *      listed in DB_BACKED_TESTS in vitest.config.ts, or it silently runs against
 *      the unroutable unit-project URL and fails confusingly.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const TEST_FILE = /\.test\.(ts|tsx|mjs)$/

/** Code whose changes count as "feature code". */
const FEATURE_CODE = [
  /^src\/lib\/services\/.+\.ts$/,
  /^src\/lib\/schemas\/.+\.ts$/,
  /^src\/lib\/config\/.+\.ts$/,
  /^src\/lib\/(hooks|utils|actions)\/.+\.tsx?$/,
  /^src\/lib\/[^/]+\.ts$/,
  /^src\/actions\/.+\.ts$/,
  /^src\/components\/.+\.tsx?$/,
  /^src\/app\/.+\.tsx?$/,
  /^src\/middleware\.ts$/,
  /^supabase\/migrations\/.+\.sql$/,
]

/** Feature code that never needs its own tests (pure wiring / markup). */
const EXEMPT = [
  /^src\/__tests__\//,
  /\.d\.ts$/,
  /\/index\.ts$/,
  /\/loading\.tsx$/,
  /^src\/app\/layout\.tsx$/,
]

/** New files here must come with a co-located test. */
const NEEDS_COLOCATED_TEST = [
  /^src\/lib\/services\/.+\.ts$/,
  /^src\/lib\/schemas\/.+\.ts$/,
  /^src\/lib\/config\/models\/.+\.ts$/,
  /^src\/components\/(?!ui\/).+\.tsx$/, // ui/ primitives are styling-only
]

const isTest = (p) => TEST_FILE.test(p)
const isFeature = (p) =>
  !isTest(p) && FEATURE_CODE.some((r) => r.test(p)) && !EXEMPT.some((r) => r.test(p))

/**
 * @param {{ path: string, status: 'A' | 'M' | 'D' }[]} changes  repo-relative, forward slashes
 * @param {{ exists: (p: string) => boolean, read: (p: string) => string }} fs
 * @returns {string[]} human-readable violations (empty = OK)
 */
export function findViolations(changes, fs) {
  const live = changes.filter((c) => c.status !== 'D')
  const changedTests = live.filter((c) => isTest(c.path))
  const changedFeature = live.filter((c) => isFeature(c.path))
  const violations = []

  // 1. Feature code needs tests in the same change.
  if (changedFeature.length > 0 && changedTests.length === 0) {
    violations.push(
      `Feature code changed without any test changes:\n${changedFeature
        .map((c) => `  - ${c.path}`)
        .join('\n')}\n  Add or update tests that cover this behavior.`
    )
  }

  // 2. New modules need a co-located test file.
  for (const c of live) {
    if (c.status !== 'A' || !isFeature(c.path)) continue
    if (!NEEDS_COLOCATED_TEST.some((r) => r.test(c.path))) continue
    const base = c.path.replace(/\.(ts|tsx)$/, '')
    const candidates = [`${base}.test.ts`, `${base}.test.tsx`]
    if (!candidates.some((t) => fs.exists(t))) {
      violations.push(
        `New file ${c.path} has no co-located test (expected ${candidates[0]} or .tsx).`
      )
    }
  }

  // 3. New migrations need a DB-backed test change.
  const newMigrations = live.filter(
    (c) => c.status === 'A' && /^supabase\/migrations\/.+\.sql$/.test(c.path)
  )
  const dbTestsChanged = changedTests.some((c) => /^src\/lib\/services\/.+\.test\.ts$/.test(c.path))
  if (newMigrations.length > 0 && !dbTestsChanged) {
    violations.push(
      `New migration(s) without a DB-backed service test change: ${newMigrations
        .map((c) => c.path)
        .join(', ')}`
    )
  }

  // 4. DB-touching tests must be registered as integration tests.
  const vitestConfig = fs.exists('vitest.config.ts') ? fs.read('vitest.config.ts') : ''
  for (const c of changedTests) {
    if (!/\.test\.tsx?$/.test(c.path)) continue
    const source = fs.read(c.path)
    if (source.includes('__tests__/utils/rls-helpers') && !vitestConfig.includes(`'${c.path}'`)) {
      violations.push(
        `${c.path} uses the database (imports rls-helpers) but is not in DB_BACKED_TESTS in vitest.config.ts.`
      )
    }
  }

  return violations
}

// ---------------------------------------------------------------------------
// git plumbing
// ---------------------------------------------------------------------------

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
}

function tryGit(args, cwd) {
  try {
    return git(args, cwd).trim()
  } catch {
    return null
  }
}

/** Parse `git diff --name-status` output into { path, status } (renames → A). */
function parseNameStatus(out) {
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [code, ...paths] = line.split('\t')
      const status = code[0] === 'R' || code[0] === 'C' ? 'A' : code[0]
      return { path: paths.at(-1), status: /** @type {'A'|'M'|'D'} */ (status) }
    })
}

function collectChanges(root, { base, includeWorkingTree }) {
  const byPath = new Map()
  const add = (list) => list.forEach((c) => byPath.set(c.path, c))

  const mergeBase = base && tryGit(['merge-base', base, 'HEAD'], root)
  if (mergeBase) add(parseNameStatus(git(['diff', '--name-status', '-M', mergeBase, 'HEAD'], root)))

  if (includeWorkingTree) {
    add(parseNameStatus(git(['diff', '--name-status', '-M', 'HEAD'], root)))
    const untracked = git(['ls-files', '--others', '--exclude-standard'], root)
    add(
      untracked
        .split('\n')
        .filter(Boolean)
        .map((p) => ({ path: p, status: /** @type {'A'} */ ('A') }))
    )
  }
  return [...byPath.values()]
}

function defaultBase(root) {
  for (const ref of ['origin/main', 'main']) {
    if (tryGit(['rev-parse', '--verify', '--quiet', ref], root)) return ref
  }
  return null
}

async function readStdin() {
  if (process.stdin.isTTY) return ''
  let data = ''
  for await (const chunk of process.stdin) data += chunk
  return data
}

async function main() {
  const args = process.argv.slice(2)
  const hookMode = args.includes('--hook')
  const baseIdx = args.indexOf('--base')
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

  if (hookMode) {
    // Claude Code Stop hook: don't re-block a stop we already blocked once, or
    // the session can loop forever.
    const input = await readStdin()
    try {
      if (JSON.parse(input || '{}').stop_hook_active) process.exit(0)
    } catch {
      /* not JSON — run the check anyway */
    }
  }

  const base = baseIdx >= 0 ? args[baseIdx + 1] : defaultBase(root)
  const changes = collectChanges(root, { base, includeWorkingTree: baseIdx < 0 })
  const violations = findViolations(changes, {
    exists: (p) => existsSync(path.join(root, p)),
    read: (p) => readFileSync(path.join(root, p), 'utf8'),
  })

  if (violations.length === 0) {
    if (!hookMode)
      console.log(`check-tests: OK (${changes.length} changed file(s) vs ${base ?? 'HEAD'})`)
    return
  }

  const message = `Test requirement not met:\n\n${violations.join('\n\n')}\n\nSee "Testing rules" in CLAUDE.md.`
  console.error(message)
  // Exit 2 = Claude Code blocks the stop and feeds stderr back to Claude.
  process.exit(hookMode ? 2 : 1)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
