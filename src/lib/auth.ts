import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type Role = 'Admin' | 'Editor' | 'Viewer'

export interface CurrentUser {
  id: string
  email: string
  name: string | null
  role: Role
}

/** Resolve the signed-in app user, or null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return null

  const { data } = await client
    .from('users')
    .select('id, email, name, role, login_enabled')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!data || !data.login_enabled) return null
  return {
    id: data.id as string,
    email: data.email as string,
    name: (data.name as string | null) ?? null,
    role: data.role as Role,
  }
}

/** Require a signed-in user, else redirect to /login. */
export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}

export function canEdit(role: Role): boolean {
  return role === 'Admin' || role === 'Editor'
}
