#!/usr/bin/env node
/**
 * Claude Code PostToolUse hook (Edit | Write | MultiEdit).
 *
 * Formats the file that was just edited with Prettier, then runs ESLint --fix
 * on code files. Formatting drift (and CRLF line endings on Windows) never
 * reaches a commit, and nobody has to remember `npm run format`.
 *
 * If ESLint still reports errors after --fix, exit 2 sends them back to Claude
 * so the next step fixes them, instead of CI finding them later.
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PRETTIER = /\.(ts|tsx|js|mjs|cjs|json|md|css|ya?ml)$/
const ESLINT = /\.(ts|tsx|js|mjs|cjs)$/
const SKIP = [/^node_modules\//, /^\.next/, /^package-lock\.json$/, /^\.omc\//]

/**
 * @param {string} rel repo-relative path, forward slashes
 * @returns {{ prettier: boolean, eslint: boolean }}
 */
export function toolsFor(rel) {
  if (rel.startsWith('../') || path.isAbsolute(rel) || SKIP.some((r) => r.test(rel))) {
    return { prettier: false, eslint: false }
  }
  return { prettier: PRETTIER.test(rel), eslint: ESLINT.test(rel) }
}

/** Run a tool's JS entry with this node — no shell, so paths with spaces and
 *  Windows .cmd shims are non-issues. */
const BINS = {
  prettier: 'node_modules/prettier/bin/prettier.cjs',
  eslint: 'node_modules/eslint/bin/eslint.js',
}
function run(root, bin, args) {
  return spawnSync(process.execPath, [path.join(root, BINS[bin]), ...args], {
    cwd: root,
    encoding: 'utf8',
  })
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
  let input = ''
  for await (const chunk of process.stdin) input += chunk
  let filePath
  try {
    filePath = JSON.parse(input || '{}').tool_input?.file_path
  } catch {
    process.exit(0)
  }
  if (!filePath) process.exit(0)

  const rel = path.relative(root, path.resolve(root, filePath)).split(path.sep).join('/')
  const tools = toolsFor(rel)
  if (tools.prettier) run(root, 'prettier', ['--write', '--log-level', 'warn', rel])
  if (tools.eslint) {
    const result = run(root, 'eslint', ['--fix', '--cache', rel])
    // 1 = lint errors remain; 2 = ESLint itself failed (config etc.) — not
    // the edit's fault, so don't bounce it back to Claude.
    if (result.status === 1) {
      console.error(`ESLint errors remain in ${rel} after --fix:\n${result.stdout}`)
      process.exit(2)
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
