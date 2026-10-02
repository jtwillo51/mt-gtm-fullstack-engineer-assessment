import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

/**
 * SERVICE LAYER CONVENTIONS
 *
 * All business logic lives here. Services are called by server actions and by
 * Server Components. Two return-type conventions:
 *
 *  - Reads  (get*, list*, count*): return raw data and THROW on DB error. A
 *    `.single()` with no rows (PGRST116) is not an error — return null.
 *  - Mutations (create*, update*, delete*): return ActionResult<T>. Wrap the
 *    body in try/catch and convert thrown errors via getErrorMessage().
 *
 * Every service takes an optional ServiceContext. When omitted, it builds an
 * RLS-scoped client from the request's cookies.
 */

export interface ServiceContext {
  client: SupabaseClient
  userId: string
}

export type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string }

export interface ListOptions {
  limit?: number
  offset?: number
  orderBy?: string
  orderAsc?: boolean
  search?: string
  /** Scope a child list to its parent company. */
  companyId?: string
}

export interface PaginatedResult<T> {
  data: T[]
  pagination: {
    total: number
    limit: number
    offset: number
  }
}

/** Resolve the RLS-scoped client, or reuse the one on the context. */
export async function getClient(ctx?: ServiceContext): Promise<SupabaseClient> {
  return ctx?.client ?? (await createClient())
}

/** Resolve the caller's stable app user id (for stamping created_by/updated_by). */
export async function getUserId(ctx?: ServiceContext): Promise<string | null> {
  if (ctx?.userId) return ctx.userId
  const client = await createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return null
  const appUserId = (user.app_metadata as { app_user_id?: string } | undefined)?.app_user_id
  if (appUserId) return appUserId
  // First-login fallback: map auth id → app id.
  const { data } = await client.from('users').select('id').eq('auth_id', user.id).maybeSingle()
  return (data?.id as string | undefined) ?? null
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return fallback
}

/** Clamp a page size to a sane range. */
export function clampLimit(limit: number | undefined, fallback = 25, max = 100): number {
  if (!limit || limit < 1) return fallback
  return Math.min(limit, max)
}
