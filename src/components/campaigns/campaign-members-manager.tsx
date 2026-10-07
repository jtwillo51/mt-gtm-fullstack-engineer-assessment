'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Building2, Plus, Search, User, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ConfirmButton } from '@/components/ui/confirm-button'
import { usePermissions } from '@/components/permission-provider'
import { badgeVariantForStatus } from '@/lib/config/render-helpers'
import { CAMPAIGN_MEMBER_STATUSES } from '@/lib/schemas/campaign.schema'
import { handleActionError } from '@/lib/utils/toast-helpers'
import { cn } from '@/lib/utils'
import type { CampaignMemberRow } from '@/lib/services/campaign-members'
import {
  addCompanyToCampaignAction,
  addContactToCampaignAction,
  addTargetIndustryCompaniesAction,
  removeCampaignMemberAction,
  searchCampaignMemberOptionsAction,
  setCampaignMemberStatusAction,
} from '@/actions/campaigns'

type MemberKind = 'company' | 'contact'
type Option = { id: string; label: string; detail: string | null }

/**
 * Who this campaign reached, and how far each got. Members are companies or
 * people; editors record each one's outcome inline, which drives the stats.
 */
export function CampaignMembersManager({
  campaignId,
  members,
  hasTargetIndustries,
}: {
  campaignId: string
  members: CampaignMemberRow[]
  hasTargetIndustries: boolean
}) {
  const router = useRouter()
  const { canEdit } = usePermissions()
  const [pending, startTransition] = useTransition()

  function run(
    fn: () => Promise<{ success: boolean; error?: string }>,
    fallback: string,
    onDone?: () => void
  ) {
    startTransition(async () => {
      const result = await fn()
      if (handleActionError(result as never, fallback)) return
      onDone?.()
      router.refresh()
    })
  }

  function addTargetIndustryCompanies() {
    startTransition(async () => {
      const result = await addTargetIndustryCompaniesAction(campaignId)
      if (!result.success) {
        handleActionError(result, 'Failed to add companies')
        return
      }
      toast.success(
        result.data.added === 0
          ? 'All matching companies are already members'
          : `Added ${result.data.added} ${result.data.added === 1 ? 'company' : 'companies'}`
      )
      router.refresh()
    })
  }

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">
          Members <span className="font-normal text-slate-400">({members.length})</span>
        </h2>
        {canEdit && hasTargetIndustries ? (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={addTargetIndustryCompanies}
          >
            <Building2 className="h-4 w-4" />
            Add all target-industry companies
          </Button>
        ) : null}
      </div>

      {canEdit ? (
        <MemberPicker
          disabled={pending}
          excludeIds={
            new Set(
              members.flatMap((m) => (m.kind === 'contact' ? [m.contact_id!] : [m.company_id!]))
            )
          }
          onPick={(kind, id) =>
            run(
              () =>
                kind === 'company'
                  ? addCompanyToCampaignAction(campaignId, id)
                  : addContactToCampaignAction(campaignId, id),
              'Failed to add member'
            )
          }
        />
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Company</th>
              <th className="px-4 py-2.5">Outcome</th>
              {canEdit ? <th className="w-10 px-2 py-2.5" /> : null}
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 4 : 3} className="px-4 py-12 text-center text-slate-400">
                  No members yet.
                </td>
              </tr>
            ) : (
              members.map((m) => (
                <tr key={m.id} className="border-b border-slate-100 last:border-0 even:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <Link
                      href={
                        m.kind === 'contact'
                          ? `/contacts/${m.contact_id}`
                          : `/companies/${m.company_id}`
                      }
                      className="inline-flex items-center gap-2 font-medium text-slate-900 hover:underline"
                    >
                      {m.kind === 'contact' ? (
                        <User className="h-3.5 w-3.5 text-slate-400" />
                      ) : (
                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                      )}
                      {m.name}
                    </Link>
                    {m.kind === 'contact' && m.title ? (
                      <span className="ml-2 text-xs text-slate-400">{m.title}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {m.kind === 'contact' && m.company_id ? (
                      <Link href={`/companies/${m.company_id}`} className="hover:underline">
                        {m.company_name}
                      </Link>
                    ) : m.kind === 'company' ? (
                      <span className="text-slate-400">{m.company_industry ?? '—'}</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {canEdit ? (
                      <select
                        aria-label={`Outcome for ${m.name}`}
                        value={m.status}
                        disabled={pending}
                        onChange={(e) =>
                          run(
                            () => setCampaignMemberStatusAction(m.id, e.target.value),
                            'Failed to update outcome'
                          )
                        }
                        className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                      >
                        {CAMPAIGN_MEMBER_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Badge variant={badgeVariantForStatus(m.status)}>{m.status}</Badge>
                    )}
                  </td>
                  {canEdit ? (
                    <td className="px-2 py-2.5 text-right">
                      <ConfirmButton
                        disabled={pending}
                        label={`Remove ${m.name}`}
                        onConfirm={() =>
                          run(() => removeCampaignMemberAction(m.id), 'Failed to remove member')
                        }
                      >
                        <X className="h-4 w-4" />
                      </ConfirmButton>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** Company/person toggle + debounced typeahead. Picking a result adds it. */
function MemberPicker({
  disabled,
  excludeIds,
  onPick,
}: {
  disabled: boolean
  excludeIds: Set<string>
  onPick: (kind: MemberKind, id: string) => void
}) {
  const [kind, setKind] = useState<MemberKind>('contact')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<Option[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setStatus('loading')
    const handle = setTimeout(async () => {
      try {
        const results = await searchCampaignMemberOptionsAction(kind, query)
        if (cancelled) return
        setOptions(results)
        setStatus('done')
      } catch {
        // A failed server action would otherwise be an unhandled rejection
        // and the dropdown would just silently stay empty.
        if (cancelled) return
        setOptions([])
        setStatus('error')
      }
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [kind, query, open])

  const visible = options.filter((o) => !excludeIds.has(o.id))
  const message =
    status === 'error'
      ? 'Search failed — try again.'
      : status === 'done' && visible.length === 0 && query.trim()
        ? `No ${kind === 'contact' ? 'people' : 'companies'} match “${query.trim()}”.`
        : null

  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
        {(['contact', 'company'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setKind(k)
              setOptions([])
            }}
            className={cn(
              'rounded-md px-2.5 py-1 text-sm font-medium transition-colors',
              kind === k ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-900'
            )}
          >
            {k === 'contact' ? 'Person' : 'Company'}
          </button>
        ))}
      </div>
      <div className="relative max-w-sm flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={query}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          // Delay so a click on a result registers before the list closes.
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={kind === 'contact' ? 'Add a person by name' : 'Add a company by name'}
          aria-label={kind === 'contact' ? 'Add a person by name' : 'Add a company by name'}
          className="pl-9"
        />
        {open && message ? (
          <p
            role="status"
            className={cn(
              'absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg',
              status === 'error' ? 'text-red-600' : 'text-slate-500'
            )}
          >
            {message}
          </p>
        ) : null}
        {open && visible.length > 0 ? (
          <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {visible.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onPick(kind, o.id)
                    setQuery('')
                    setOpen(false)
                  }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm hover:bg-slate-50"
                >
                  <span className="truncate font-medium text-slate-900">{o.label}</span>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-slate-400">
                    {o.detail}
                    <Plus className="h-3.5 w-3.5" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
