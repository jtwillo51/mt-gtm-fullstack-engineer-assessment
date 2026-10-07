import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import type { Role } from '@/lib/auth'
import type { ServiceContext } from '@/lib/services/base'
import type { Database } from '@/types/database.generated'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export interface TestUser {
  id: string // public.users.id (app id)
  authId: string // auth.users.id
  email: string
  password: string
  role: Role
}

/** RLS-bypassing admin client for setup / assertions. */
export function getAdminClientForTests(): SupabaseClient<Database> {
  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Create an isolated auth user + public.users row. BOTH ids are set, and
 * app_user_id is embedded in app_metadata so the JWT carries it — without that,
 * is_admin()/is_editor() fail and every RLS write is silently blocked.
 */
export async function createTestUser(role: Role): Promise<TestUser> {
  const admin = getAdminClientForTests()
  const appId = randomUUID()
  const email = `test_${randomUUID().slice(0, 8)}@example.com`
  const password = 'test-password-123'

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { app_user_id: appId },
  })
  if (authError || !created.user) throw authError ?? new Error('Failed to create auth user')

  const { error: rowError } = await admin.from('users').insert({
    id: appId,
    auth_id: created.user.id,
    email,
    name: `Test ${role}`,
    role,
    login_enabled: true,
  })
  if (rowError) throw rowError

  return { id: appId, authId: created.user.id, email, password, role }
}

export async function createIsolatedTestUsers(): Promise<{
  admin: TestUser
  editor: TestUser
  viewer: TestUser
}> {
  const admin = await createTestUser('Admin')
  const editor = await createTestUser('Editor')
  const viewer = await createTestUser('Viewer')
  return { admin, editor, viewer }
}

/** Sign in as the user and return an RLS-scoped ServiceContext. */
export async function createTestUserContext(user: TestUser): Promise<ServiceContext> {
  const client = createClient<Database>(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  })
  if (error) throw error
  return { client, userId: user.id }
}

export async function deleteTestUser(authId: string, appId: string): Promise<void> {
  const admin = getAdminClientForTests()
  await admin.from('users').delete().eq('id', appId)
  await admin.auth.admin.deleteUser(authId)
}
