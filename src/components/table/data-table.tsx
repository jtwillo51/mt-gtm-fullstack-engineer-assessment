'use client'

import { useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import type { ListViewConfig, RenderType } from '@/lib/config/types'
import type { PaginatedResult } from '@/lib/services/base'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CompanyTile } from '@/components/ui/company-tile'
import { InitialsAvatar } from '@/components/ui/initials-avatar'
import { badgeVariantForStatus } from '@/lib/config/render-helpers'

/**
 * Config-driven list table. Renders the config's default-visible columns, a
 * search box, and pagination — all URL-driven so the Server Component page
 * re-fetches on navigation. Rows link to `${linkPath}/${id}`.
 *
 * Cell rendering is keyed off each column's string `renderType` (never a
 * function prop — this component is the client side of the Server→Client
 * boundary). Add a renderType case here and reference it from a model config.
 */
export function DataTable<T extends { id: string }>({
  data,
  config,
  linkPath,
  emptyMessage = 'No records found.',
}: {
  data: PaginatedResult<T>
  config: ListViewConfig
  linkPath: string
  emptyMessage?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('search') ?? '')

  const columns = config.columns.filter((c) => c.defaultVisible)
  const { total, limit, offset } = data.pagination
  const page = Math.floor(offset / limit) + 1
  const pageCount = Math.max(1, Math.ceil(total / limit))

  function pushParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString())
    mutate(params)
    router.push(`${pathname}?${params.toString()}`)
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    pushParams((p) => {
      if (search) p.set('search', search)
      else p.delete('search')
      p.delete('page')
    })
  }

  return (
    <div className="space-y-3">
      <form onSubmit={onSearchSubmit} className="relative max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="pl-9"
        />
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              {columns.map((col) => (
                <th key={col.field} className="px-4 py-2.5">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.data.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => router.push(`${linkPath}/${row.id}`)}
                  className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  {columns.map((col) => (
                    <td key={col.field} className="px-4 py-3 text-slate-700">
                      {renderCell(
                        (row as Record<string, unknown>)[col.field],
                        col.renderType,
                        row as Record<string, unknown>
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          {total} {total === 1 ? 'record' : 'records'}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => pushParams((p) => p.set('page', String(page - 1)))}
          >
            Prev
          </Button>
          <span>
            Page {page} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => pushParams((p) => p.set('page', String(page + 1)))}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}

function renderCell(
  value: unknown,
  renderType: RenderType | undefined,
  row: Record<string, unknown>
) {
  if (renderType === 'company-name') {
    const name = value == null ? '' : String(value)
    return (
      <span className="inline-flex items-center gap-2 font-medium text-slate-900">
        <CompanyTile name={name} size="sm" />
        {name || <span className="text-slate-300">—</span>}
      </span>
    )
  }

  if (renderType === 'person-name') {
    const full = [row.first_name, row.last_name].filter(Boolean).join(' ') || String(value ?? '')
    return (
      <span className="inline-flex items-center gap-2 font-medium text-slate-900">
        <InitialsAvatar name={full} size="sm" />
        {full || <span className="text-slate-300">—</span>}
      </span>
    )
  }

  if (value === null || value === undefined || value === '') {
    return <span className="text-slate-300">—</span>
  }
  const str = String(value)

  switch (renderType) {
    case 'badge':
      return <Badge variant={badgeVariantForStatus(str)}>{str}</Badge>
    case 'url':
      return (
        <a
          href={str}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-indigo-600 hover:underline"
        >
          {str}
        </a>
      )
    case 'email':
      return (
        <a
          href={`mailto:${str}`}
          onClick={(e) => e.stopPropagation()}
          className="text-indigo-600 hover:underline"
        >
          {str}
        </a>
      )
    case 'datetime':
      return <span>{new Date(str).toLocaleDateString()}</span>
    default:
      return <span>{str}</span>
  }
}
