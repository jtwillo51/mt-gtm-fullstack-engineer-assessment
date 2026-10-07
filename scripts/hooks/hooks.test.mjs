import { describe, expect, it } from 'vitest'
import { blockReason } from './guard-files.mjs'
import { toolsFor } from './format-file.mjs'

const repo = (onMain = []) => ({ onBaseBranch: (rel) => onMain.includes(rel) })

describe('guard-files: blockReason', () => {
  it('blocks editing a migration that is already on the base branch', () => {
    const rel = 'supabase/migrations/0002_companies.sql'
    expect(blockReason(rel, repo([rel]))).toMatch(/forward-only/)
  })

  it('allows a new migration that only exists on this branch', () => {
    expect(blockReason('supabase/migrations/0007_new.sql', repo())).toBeNull()
  })

  it('blocks hand edits to generated types and the lockfile', () => {
    expect(blockReason('src/types/database.generated.ts', repo())).toMatch(/db:types/)
    expect(blockReason('package-lock.json', repo())).toMatch(/npm install/)
  })

  it.each(['.env', '.env.local', '.env.production.local', 'apps/x/.env.local'])(
    'blocks secrets file %s',
    (rel) => {
      expect(blockReason(rel, repo())).toMatch(/secrets/)
    }
  )

  it('allows the documented env template', () => {
    expect(blockReason('.env.example', repo())).toBeNull()
  })

  it.each(['src/lib/services/campaigns.ts', 'README.md', 'supabase/seed.sql'])(
    'allows ordinary file %s',
    (rel) => {
      expect(blockReason(rel, repo())).toBeNull()
    }
  )

  it('ignores files outside the repo', () => {
    expect(blockReason('../other/.env', repo())).toBeNull()
  })
})

describe('format-file: toolsFor', () => {
  it.each([
    ['src/lib/services/campaigns.ts', { prettier: true, eslint: true }],
    ['src/components/table/data-table.tsx', { prettier: true, eslint: true }],
    ['scripts/check-tests.mjs', { prettier: true, eslint: true }],
    ['README.md', { prettier: true, eslint: false }],
    ['.github/workflows/ci.yml', { prettier: true, eslint: false }],
    ['supabase/migrations/0006_data_integrity.sql', { prettier: false, eslint: false }],
    ['package-lock.json', { prettier: false, eslint: false }],
    ['node_modules/x/index.js', { prettier: false, eslint: false }],
    ['../elsewhere/file.ts', { prettier: false, eslint: false }],
  ])('%s → %j', (rel, expected) => {
    expect(toolsFor(rel)).toEqual(expected)
  })
})
