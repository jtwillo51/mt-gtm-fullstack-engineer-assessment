'use client'

import { useEffect } from 'react'
import { ErrorState } from '@/components/page/error-state'
import { Button } from '@/components/ui/button'

/**
 * Error boundary for the campaign pages. A thrown service read lands here
 * inside the app shell (sidebar intact) instead of Next's default error
 * screen. The raw message is not shown: in production Next replaces it with a
 * digest anyway, and it can leak SQL.
 */
export default function CampaignsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <ErrorState
      title="Something went wrong"
      message={
        <>
          This page couldn&apos;t be loaded. Try again, and if it keeps happening, share this
          reference with support{error.digest ? `: ${error.digest}` : '.'}
        </>
      }
      action={<Button onClick={reset}>Try again</Button>}
      homeHref="/campaigns"
      homeLabel="Back to Campaigns"
    />
  )
}
