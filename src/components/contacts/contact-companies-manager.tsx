'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Star, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { usePermissions } from '@/components/permission-provider'
import { handleActionError } from '@/lib/utils/toast-helpers'
import type { ContactCompany } from '@/lib/services/contact-companies'
import {
  attachContactCompanyAction,
  setPrimaryContactCompanyAction,
  removeContactCompanyAction,
} from '@/actions/contacts'

/**
 * Manages a contact's company memberships (the many-to-many). Lists each
 * company with a Primary badge, lets you set the primary / remove, and add the
 * contact to another company. Writes go through server actions + router.refresh.
 */
export function ContactCompaniesManager({
  contactId,
  memberships,
  companyOptions,
}: {
  contactId: string
  memberships: ContactCompany[]
  companyOptions: { id: string; name: string }[]
}) {
  const router = useRouter()
  const { canEdit } = usePermissions()
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState('')

  const attachedIds = new Set(memberships.map((m) => m.company_id))
  const available = companyOptions.filter((c) => !attachedIds.has(c.id))

  function run(fn: () => Promise<{ success: boolean; error?: string }>, fallback: string) {
    startTransition(async () => {
      const result = await fn()
      if (handleActionError(result as never, fallback)) return
      router.refresh()
    })
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Companies
      </h3>

      <ul className="divide-y divide-slate-100">
        {memberships.length === 0 ? (
          <li className="py-2 text-sm text-slate-400">Not linked to any company yet.</li>
        ) : (
          memberships.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex items-center gap-2">
                <Link
                  href={`/companies/${m.company_id}`}
                  className="text-sm font-medium text-slate-900 hover:underline"
                >
                  {m.company_name ?? 'Company'}
                </Link>
                {m.is_primary ? <Badge variant="subtle">Primary</Badge> : null}
              </div>
              {canEdit ? (
                <div className="flex items-center gap-1">
                  {!m.is_primary ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        run(() => setPrimaryContactCompanyAction(m.id), 'Failed to set primary')
                      }
                    >
                      <Star className="h-3.5 w-3.5" />
                      Make primary
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    aria-label="Remove"
                    onClick={() =>
                      run(() => removeContactCompanyAction(m.id), 'Failed to remove company')
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
            </li>
          ))
        )}
      </ul>

      {canEdit && available.length > 0 ? (
        <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <option value="">Add to company…</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            disabled={pending || !selected}
            onClick={() =>
              run(() => attachContactCompanyAction(contactId, selected), 'Failed to add company')
            }
          >
            Add
          </Button>
        </div>
      ) : null}
    </section>
  )
}
