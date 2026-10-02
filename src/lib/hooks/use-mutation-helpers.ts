'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { queryKeys, type ModelName } from '@/lib/query-keys'

/**
 * Standard post-mutation handler: invalidate the model's cache, optionally
 * refresh the current route (so Server Component data updates), and toast.
 * Pass `skipRefresh: true` when you immediately navigate away.
 */
export function useMutationSuccess() {
  const queryClient = useQueryClient()
  const router = useRouter()

  async function onMutationSuccess(
    model: ModelName,
    opts: { message?: string; skipRefresh?: boolean } = {}
  ) {
    await queryClient.invalidateQueries({ queryKey: queryKeys[model].all })
    if (!opts.skipRefresh) router.refresh()
    if (opts.message) toast.success(opts.message)
  }

  return { onMutationSuccess }
}
