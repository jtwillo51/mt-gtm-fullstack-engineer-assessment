import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role client — BYPASSES RLS. Only for webhooks / background jobs /
 * test setup where there is no user session. NEVER use in server actions or
 * forms (use the RLS-scoped server client there instead).
 *
 * When writing through this client, set created_by / updated_by explicitly —
 * the audit trigger can't resolve a user without a session.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
