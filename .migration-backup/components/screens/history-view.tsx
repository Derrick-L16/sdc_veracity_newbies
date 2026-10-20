'use client'

import { History, Search } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '@/components/app/app-provider'
import { Input } from '@/components/ui/input'
import { CaseRow } from '@/components/veracity/case-row'
import { EmptyState, PageHeader } from '@/components/veracity/primitives'
import { CLOSED_STATUSES } from '@/lib/data'

export function HistoryView() {
  const { cases } = useApp()
  const [query, setQuery] = useState('')
  const closed = cases
    .filter((c) => CLOSED_STATUSES.includes(c.status))
    .sort((a, b) => new Date(b.decision?.at ?? b.createdAt).getTime() - new Date(a.decision?.at ?? a.createdAt).getTime())
  const q = query.trim().toLowerCase()
  const visible = q ? closed.filter((c) => c.product.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)) : closed

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="History" subtitle="Closed cases. Each one keeps a permanent Decision Passport.">
        <div className="relative w-full md:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-fg-tertiary" aria-hidden="true" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search product or ID"
            aria-label="Search history"
            className="h-11 rounded-full border-line bg-surface pl-10"
          />
        </div>
      </PageHeader>

      {visible.length === 0 ? (
        <EmptyState
          icon={History}
          title={q ? 'No matches' : 'No closed cases yet'}
          description={q ? 'Try a different product name or case ID.' : 'Approved and rejected cases appear here.'}
        />
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Closed cases">
          {visible.map((c) => (
            <CaseRow key={c.id} stockCase={c} href={`/history/${c.id}`} />
          ))}
        </ul>
      )}
    </div>
  )
}
