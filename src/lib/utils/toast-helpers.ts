import { toast } from 'sonner'
import type { ActionResult } from '@/lib/services/base'

/**
 * Returns true (and shows an error toast) if the action failed — use as an
 * early-exit guard before a deferred success toast.
 */
export function handleActionError(result: ActionResult<unknown>, fallback: string): boolean {
  if (!result.success) {
    toast.error(result.error || fallback)
    return true
  }
  return false
}

/**
 * Shows a success or error toast and returns a type-narrowed boolean so the
 * caller can safely read result.data after a `true`.
 */
export function handleActionResult<T>(
  result: ActionResult<T>,
  messages: { success: string }
): result is { success: true; data: T } {
  if (result.success) {
    toast.success(messages.success)
    return true
  }
  toast.error(result.error)
  return false
}
