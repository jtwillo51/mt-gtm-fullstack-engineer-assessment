import type { ReactNode } from 'react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

/**
 * Full-page "something went wrong / not found" message, shared by the route
 * error boundaries and not-found pages so failures look like part of the app
 * instead of Next's default crash screen.
 */
export function ErrorState({
  title,
  message,
  action,
  homeHref = '/companies',
  homeLabel = 'Go to Companies',
}: {
  title: string
  message: ReactNode
  /** Primary action, e.g. a "Try again" button from an error boundary. */
  action?: ReactNode
  homeHref?: string
  homeLabel?: string
}) {
  return (
    <div role="alert" className="mx-auto max-w-md py-20 text-center">
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">{message}</p>
      <div className="mt-6 flex items-center justify-center gap-2">
        {action}
        <Link href={homeHref} className={buttonVariants({ variant: 'outline' })}>
          {homeLabel}
        </Link>
      </div>
    </div>
  )
}
