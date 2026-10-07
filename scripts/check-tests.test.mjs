import { describe, expect, it } from 'vitest'
import { findViolations } from './check-tests.mjs'

/** In-memory repo: files that exist, with optional contents. */
function repo(files = {}) {
  return {
    exists: (p) => p in files,
    read: (p) => files[p] ?? '',
  }
}

const vitestConfig = "const DB_BACKED_TESTS = [\n  'src/lib/services/widgets.test.ts',\n]"

describe('check-tests: findViolations', () => {
  it('passes when nothing changed', () => {
    expect(findViolations([], repo())).toEqual([])
  })

  it('passes for docs / config-only changes', () => {
    const changes = [
      { path: 'README.md', status: 'M' },
      { path: 'package.json', status: 'M' },
    ]
    expect(findViolations(changes, repo())).toEqual([])
  })

  it('flags feature code changed with no test changes', () => {
    const v = findViolations([{ path: 'src/lib/services/widgets.ts', status: 'M' }], repo())
    expect(v).toHaveLength(1)
    expect(v[0]).toContain('Feature code changed without any test changes')
    expect(v[0]).toContain('src/lib/services/widgets.ts')
  })

  it('passes when a test changed alongside the feature code', () => {
    const changes = [
      { path: 'src/components/widget-card.tsx', status: 'M' },
      { path: 'src/components/widget-card.test.tsx', status: 'M' },
    ]
    expect(findViolations(changes, repo())).toEqual([])
  })

  it('ignores deletions and exempt wiring files', () => {
    const changes = [
      { path: 'src/lib/services/old.ts', status: 'D' },
      { path: 'src/app/(dashboard)/widgets/loading.tsx', status: 'M' },
      { path: 'src/lib/schemas/index.ts', status: 'M' },
    ]
    expect(findViolations(changes, repo())).toEqual([])
  })

  it.each([
    'src/lib/services/widgets.ts',
    'src/lib/schemas/widget.schema.ts',
    'src/lib/config/models/widget-config.ts',
    'src/components/widgets/widget-card.tsx',
  ])('requires a co-located test for new %s', (file) => {
    const changes = [
      { path: file, status: 'A' },
      { path: 'src/lib/other.test.ts', status: 'A' },
    ]
    const v = findViolations(changes, repo({ [file]: '' }))
    expect(v.some((x) => x.includes(`New file ${file} has no co-located test`))).toBe(true)

    const test = file.replace(/\.(ts|tsx)$/, file.endsWith('.tsx') ? '.test.tsx' : '.test.ts')
    expect(findViolations(changes, repo({ [file]: '', [test]: '' }))).toEqual([])
  })

  it('does not require co-located tests for ui primitives or pages', () => {
    const changes = [
      { path: 'src/components/ui/chip.tsx', status: 'A' },
      { path: 'src/app/(dashboard)/widgets/page.tsx', status: 'A' },
      { path: 'src/lib/config/models/widget-config.test.ts', status: 'M' },
    ]
    expect(findViolations(changes, repo())).toEqual([])
  })

  it('requires a DB-backed test change for a new migration', () => {
    const migration = { path: 'supabase/migrations/0006_widgets.sql', status: 'A' }
    const unitOnly = [migration, { path: 'src/lib/schemas/widget.schema.test.ts', status: 'A' }]
    expect(findViolations(unitOnly, repo()).some((v) => v.includes('New migration'))).toBe(true)

    const withDbTest = [migration, { path: 'src/lib/services/widgets.test.ts', status: 'A' }]
    expect(
      findViolations(withDbTest, repo({ 'vitest.config.ts': vitestConfig })).some((v) =>
        v.includes('New migration')
      )
    ).toBe(false)
  })

  it('requires DB-touching tests to be registered in DB_BACKED_TESTS', () => {
    const files = {
      'vitest.config.ts': vitestConfig,
      'src/lib/services/gadgets.test.ts': "import x from '@/__tests__/utils/rls-helpers'",
      'src/lib/services/widgets.test.ts': "import x from '@/__tests__/utils/rls-helpers'",
    }
    const unregistered = findViolations(
      [{ path: 'src/lib/services/gadgets.test.ts', status: 'A' }],
      repo(files)
    )
    expect(unregistered[0]).toContain('not in DB_BACKED_TESTS')

    const registered = findViolations(
      [{ path: 'src/lib/services/widgets.test.ts', status: 'M' }],
      repo(files)
    )
    expect(registered).toEqual([])
  })
})
