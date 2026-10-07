import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'

/**
 * Two projects, split by DB-dependency (not by directory):
 *
 *  - `unit`        — jsdom, no Supabase. Pure/mocked tests. Supabase env is
 *                    pointed at an unroutable host so a DB test accidentally
 *                    left out of DB_BACKED_TESTS fails loudly instead of
 *                    silently hitting the real local DB.
 *  - `integration` — node, hits the local Supabase stack (RLS, triggers,
 *                    constraints). Only the files listed below run here.
 *
 * ⚠️ When you add a DB-touching test, add it to DB_BACKED_TESTS.
 */
const DB_BACKED_TESTS = [
  'src/lib/services/companies.test.ts',
  'src/lib/services/contacts.test.ts',
  'src/lib/services/contact-companies.test.ts',
  'src/lib/services/campaigns.test.ts',
  'src/lib/services/campaign-members.test.ts',
  'src/lib/services/campaign-shape.test.ts',
  'src/lib/services/campaign-artifacts.test.ts',
  'src/lib/services/db-conventions.test.ts',
]

const alias = { '@': fileURLToPath(new URL('./src', import.meta.url)) }

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
          exclude: DB_BACKED_TESTS,
          setupFiles: ['./src/__tests__/setup-unit.ts'],
          env: {
            // Unroutable on purpose — see header.
            NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:1',
            NEXT_PUBLIC_SUPABASE_ANON_KEY: 'unit-placeholder',
            SUPABASE_SERVICE_ROLE_KEY: 'unit-placeholder',
          },
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'integration',
          environment: 'node',
          include: DB_BACKED_TESTS,
          globalSetup: './src/__tests__/global-setup.ts',
          testTimeout: 20000,
          hookTimeout: 20000,
        },
      },
    ],
  },
})
