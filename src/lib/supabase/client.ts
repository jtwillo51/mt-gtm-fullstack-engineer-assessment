import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database.generated'

/** Browser client — used by the login page and client-side auth helpers. */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
