import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readdirSync } from 'node:fs'
import { Client } from 'pg'

/**
 * The project's database conventions, enforced against the live schema.
 *
 * The README and CLAUDE.md say every business table has the audit block, the
 * audit trigger, soft delete, RLS with the restrictive active-user gate, and
 * that every view is security_invoker. Until now that was review-only. This
 * test reads the Postgres catalog after all migrations have run, so a new
 * table that forgets any of it fails CI with a message saying what's missing.
 *
 * Talks to Postgres directly (not PostgREST) because the catalog isn't
 * exposed over the API. Local stack default; override with SUPABASE_DB_URL.
 */

const DB_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

/** Public tables that are NOT business records (no audit block / soft delete). */
const NON_BUSINESS_TABLES = new Set(['users'])

const AUDIT_COLUMNS = [
  'owner_id',
  'created_at',
  'created_by',
  'updated_at',
  'updated_by',
  'deleted_at',
  'deleted_by',
]

let db: Client
let tables: { name: string; rls: boolean }[]
let businessTables: string[]

beforeAll(async () => {
  db = new Client({ connectionString: DB_URL })
  await db.connect()
  const { rows } = await db.query<{ name: string; rls: boolean }>(`
    SELECT c.relname AS name, c.relrowsecurity AS rls
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY 1`)
  tables = rows
  businessTables = rows.map((r) => r.name).filter((n) => !NON_BUSINESS_TABLES.has(n))
})

afterAll(async () => {
  await db?.end()
})

describe('database conventions (every public table)', () => {
  it('finds the expected business tables', () => {
    // Sanity check that the catalog query works; extend when you add a model.
    expect(businessTables).toEqual(
      expect.arrayContaining(['companies', 'contacts', 'campaigns', 'campaign_members'])
    )
  })

  it('has row level security enabled on every table', () => {
    const missing = tables.filter((t) => !t.rls).map((t) => t.name)
    expect(missing, 'ALTER TABLE … ENABLE ROW LEVEL SECURITY').toEqual([])
  })
})

describe('database conventions (business tables)', () => {
  it('carries the full audit block', async () => {
    const { rows } = await db.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = ANY($1)`,
      [businessTables]
    )
    const missing = businessTables.flatMap((t) =>
      AUDIT_COLUMNS.filter(
        (col) => !rows.some((r) => r.table_name === t && r.column_name === col)
      ).map((col) => `${t}.${col}`)
    )
    expect(missing, 'copy the audit block from 0002_companies.sql').toEqual([])
  })

  it('stamps audit fields with the handle_audit_fields trigger on insert and update', async () => {
    const { rows } = await db.query<{ table_name: string }>(
      `SELECT c.relname AS table_name
       FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_proc p ON p.oid = t.tgfoid
       WHERE p.proname = 'handle_audit_fields'
         AND NOT t.tgisinternal
         AND (t.tgtype & 2) <> 0   -- BEFORE
         AND (t.tgtype & 4) <> 0   -- INSERT
         AND (t.tgtype & 16) <> 0  -- UPDATE`
    )
    const withTrigger = new Set(rows.map((r) => r.table_name))
    expect(
      businessTables.filter((t) => !withTrigger.has(t)),
      'CREATE TRIGGER audit_<table>_fields BEFORE INSERT OR UPDATE … handle_audit_fields()'
    ).toEqual([])
  })

  it('has a permissive policy for each of SELECT, INSERT, UPDATE and DELETE', async () => {
    const { rows } = await db.query<{ tablename: string; cmd: string }>(
      `SELECT tablename, cmd FROM pg_policies
       WHERE schemaname = 'public' AND permissive = 'PERMISSIVE'`
    )
    const missing = businessTables.flatMap((t) =>
      ['SELECT', 'INSERT', 'UPDATE', 'DELETE']
        .filter((cmd) => !rows.some((r) => r.tablename === t && r.cmd === cmd))
        .map((cmd) => `${t}: ${cmd}`)
    )
    expect(missing, 'copy the four policies from 0002_companies.sql').toEqual([])
  })

  it('has the restrictive active-user gate on every command', async () => {
    const { rows } = await db.query<{ tablename: string }>(
      `SELECT tablename FROM pg_policies
       WHERE schemaname = 'public' AND permissive = 'RESTRICTIVE' AND cmd = 'ALL'
         AND roles @> ARRAY['authenticated']::name[]
         AND qual LIKE '%is_active_app_user()%'
         AND with_check LIKE '%is_active_app_user()%'`
    )
    const gated = new Set(rows.map((r) => r.tablename))
    expect(
      businessTables.filter((t) => !gated.has(t)),
      'add "<table>_active_app_membership" AS RESTRICTIVE FOR ALL (see 0002_companies.sql)'
    ).toEqual([])
  })

  it('indexes every foreign key column (except audit user FKs)', async () => {
    const { rows } = await db.query<{ table_name: string; column_name: string }>(
      `SELECT c.relname AS table_name, a.attname AS column_name
       FROM pg_constraint k
       JOIN pg_class c ON c.oid = k.conrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = k.conkey[1]
       WHERE k.contype = 'f' AND n.nspname = 'public' AND array_length(k.conkey, 1) = 1
         AND k.confrelid <> 'public.users'::regclass
         AND NOT EXISTS (
           SELECT 1 FROM pg_index i
           WHERE i.indrelid = k.conrelid AND i.indkey[0] = k.conkey[1]
         )`
    )
    expect(
      rows.map((r) => `${r.table_name}.${r.column_name}`),
      'parent lookups and RLS joins need an index on the FK column'
    ).toEqual([])
  })
})

describe('database conventions (views)', () => {
  it('runs every public view as the caller (security_invoker), so RLS applies', async () => {
    const { rows } = await db.query<{ name: string; options: string[] | null }>(
      `SELECT c.relname AS name, c.reloptions AS options
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'v'`
    )
    expect(rows.length).toBeGreaterThan(0)
    const unsafe = rows
      .filter((v) => !(v.options ?? []).includes('security_invoker=true'))
      .map((v) => v.name)
    expect(unsafe, 'ALTER VIEW … SET (security_invoker = true) — re-apply after DROP VIEW').toEqual(
      []
    )
  })
})

describe('migration files', () => {
  it('are numbered uniquely and sequentially (NNNN_name.sql)', () => {
    const files = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql'))
    for (const f of files) expect(f).toMatch(/^\d{4}_[a-z0-9_]+\.sql$/)
    const numbers = files.map((f) => Number(f.slice(0, 4))).sort((a, b) => a - b)
    expect(numbers).toEqual(numbers.map((_, i) => i + 1))
  })
})
