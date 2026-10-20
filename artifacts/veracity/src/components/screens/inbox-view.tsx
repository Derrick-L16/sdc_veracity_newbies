
import { ClipboardList, Inbox, X } from 'lucide-react'
import { Link } from 'wouter'
import { useRef, useState } from 'react'
import { useApp } from '@/components/app/app-provider'
import { buttonVariants } from '@/components/ui/button'
import { STATUS_LABEL } from '@/components/veracity/badges'
import { CaseRow } from '@/components/veracity/case-row'
import { EmptyState, PageHeader } from '@/components/veracity/primitives'
import { SEGMENT_LABEL, StaffHealth, StockHealth, StockHealthBar } from '@/components/veracity/stock-health'
import { useOutOfView } from '@/hooks/use-out-of-view'
import { sortInbox } from '@/lib/data'
import { SEGMENT_STATUSES, type SegmentKey } from '@/lib/stock'
import type { CaseStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const FILTERS: (CaseStatus | 'all')[] = ['all', 'pending_approval', 'manual_review', 'needs_review']

const SEGMENT_EMPTY: Record<SegmentKey, string> = {
  verified: 'Verified items match their record or have an approved difference, so they have no open case.',
  awaiting: 'No differences are waiting for approval.',
  attention: 'No items need attention right now.',
  not_counted: 'Items that are not counted yet have no case. Start a count to check them.',
}

export function InboxView() {
  const { inboxCases, role, summary, progress, loading, error } = useApp()
  const [filter, setFilter] = useState<CaseStatus | 'all'>('all')
  const [segment, setSegment] = useState<SegmentKey | null>(null)
  const overviewRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const collapsed = useOutOfView(overviewRef)

  const sorted = sortInbox(inboxCases)
  const visible = segment
    ? sorted.filter((c) => SEGMENT_STATUSES[segment].includes(c.status))
    : filter === 'all'
      ? sorted
      : sorted.filter((c) => c.status === filter)

  const selectSegment = (key: SegmentKey | null) => {
    setSegment(key)
    setFilter('all')
    if (key) listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const subtitle =
    role === 'staff'
      ? 'Cases you submitted. A manager will review them.'
      : role === 'owner'
        ? 'All open cases. You have read-only access.'
        : 'Open cases that need a decision. Pending approval is listed first.'

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Inbox" subtitle={subtitle}>
        <Link href="/count" className={cn(buttonVariants({ size: 'lg' }), 'self-start md:self-auto')}>
          <ClipboardList aria-hidden="true" />
          New count
        </Link>
      </PageHeader>

      <div ref={overviewRef}>
        {role === 'staff' ? (
          <StaffHealth progress={progress} />
        ) : (
          <StockHealth state={loading ? 'loading' : error ? 'error' : undefined} summary={summary} selected={segment} onSelect={selectSegment} />
        )}
      </div>

      {role !== 'staff' && (
        <div
          aria-hidden={!collapsed}
          className={cn(
            'fixed inset-x-0 top-16 z-20 transition-[opacity,translate] duration-200 md:hidden',
            collapsed ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0',
          )}
        >
          <StockHealthBar summary={summary} />
        </div>
      )}

      <div ref={listRef} id="case-list" className="flex scroll-mt-24 flex-col gap-4">
        <div role="group" aria-label="Filter by status" className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          {FILTERS.map((f) => {
            const count = f === 'all' ? sorted.length : sorted.filter((c) => c.status === f).length
            const active = !segment && filter === f
            return (
              <button
                key={f}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setSegment(null)
                  setFilter(f)
                }}
                className={cn(
                  'flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-body-sm font-medium transition-colors',
                  active
                    ? 'border-accent-text bg-accent-fill/15 text-fg'
                    : 'border-line text-fg-secondary hover:text-fg',
                )}
              >
                {f === 'all' ? 'All' : STATUS_LABEL[f]}
                <span className="num text-fg-tertiary">{count}</span>
              </button>
            )
          })}
        </div>

        {segment && (
          <p className="flex flex-wrap items-center gap-2 text-body-sm text-fg-secondary" aria-live="polite">
            Showing cases for <span className="font-medium text-fg">{SEGMENT_LABEL[segment]}</span>
            <button
              type="button"
              onClick={() => setSegment(null)}
              className="inline-flex min-h-8 items-center gap-1 rounded-full border border-line px-3 text-caption font-medium text-fg hover:border-fg-tertiary"
            >
              <X className="size-3.5" aria-hidden="true" />
              Clear
            </button>
          </p>
        )}

        {visible.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={segment ? `No open cases for ${SEGMENT_LABEL[segment]}` : filter === 'all' ? 'No open cases' : 'Nothing in this filter'}
            description={
              segment
                ? SEGMENT_EMPTY[segment]
                : filter === 'all'
                  ? 'Every count matches the record or has been decided.'
                  : 'Try another status filter.'
            }
          />
        ) : (
          <ul className="flex flex-col gap-3" aria-label="Open cases">
            {visible.map((c) => (
              <CaseRow key={c.id} stockCase={c} href={`/cases/${c.id}`} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
