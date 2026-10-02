import { config } from 'dotenv'

/**
 * Integration project only: load .env.local and assert the local Supabase
 * credentials are present before any DB-backed test runs.
 */
export default function setup() {
  config({ path: '.env.local' })

  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]
  const missing = required.filter((k) => !process.env[k])
  if (missing.length > 0) {
    throw new Error(
      `Integration tests need a local Supabase stack. Missing env: ${missing.join(', ')}.\n` +
        `Run \`supabase start\` and copy the values into .env.local (see .env.example).`
    )
  }
}
