import { ArrowRight, Eye, FileSearch, Lock, RotateCcw, Scale, Search, ShieldAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'wouter'
import { useApp } from '@/components/app/app-provider'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Block } from '@/components/veracity/feedback'
import { Card, EmptyState, ErrorNotice, LockNote, PageHeader } from '@/components/veracity/primitives'
import { CLOSED_STATUSES, ROLE_INFO } from '@/lib/data'
import { formatSigned } from '@/lib/format'
import { formatKl, isValidDateKey, klDateKey, klSortValue } from '@/lib/kl-time'
import type { Decision, StockCase } from '@/lib/types'
import { cn } from '@/lib/utils'

type Action = Decision['action']
const ACTIONS: { key: Action | 'all'; label: string }[] = [
  { key: 'all', label: 'All actions' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'overridden', label: 'Overridden' },
]
const ACTION_STYLE: Record<Action, string> = {
  approved: 'tint-success text-success',
  rejected: 'tint-neutral text-fg-secondary',
  overridden: 'tint-warning text-warning',
}
const ACTION_LABEL: Record<Action, string> = { approved: 'Approved', rejected: 'Rejected', overridden: 'Overridden' }

type Decided = StockCase & { decision: Decision }

/** Rejection never mutates stock; show the saved decision-time stock, not a guess. */
function outcome(c: Decided): { after: number | null; change: number | null } {
  if (c.decision.action === 'rejected') return { after: typeof c.finalStock === 'number' ? c.finalStock : null, change: 0 }
  if (typeof c.finalStock !== 'number') return { after: null, change: null }
  return { after: c.finalStock, change: c.finalStock - c.recorded }
}

const FIELD = 'h-11 rounded-full border-line bg-surface'

export function OwnerDecisionsView() {
  const { role, cases, loading, error, refresh } = useApp()
  if (loading) return <DecisionsSkeleton />
  if (role !== 'owner') return <AccessPanel role={role} />
  // Keyed by role so filters never survive a role change.
  return <OwnerDecisions key={role} cases={cases} error={error} refresh={refresh} />
}

function AccessPanel({ role }: { role: 'staff' | 'manager' }) {
  return (
    <div data-testid="panel-decisions-access" className="mx-auto max-w-xl">
      <EmptyState
        icon={Lock}
        title="Decision overview is for owners"
        description={
          role === 'manager'
            ? 'You are signed in as a manager. The same closed decisions, with full Decision Passports, are available in History.'
            : 'You are signed in as staff. Your own submitted cases and their outcomes are on My work.'
        }
        action={
          <Link href={role === 'manager' ? '/history' : '/'} className={buttonVariants({ variant: 'secondary' })} data-testid="link-access-home">
            {role === 'manager' ? 'Open History' : 'Go to your home'}
          </Link>
        }
      />
    </div>
  )
}

function DecisionsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading decisions">
      <Block className="h-10 w-64" />
      <Block className="h-24 w-full" />
      {[0, 1, 2].map((i) => <Block key={i} className="h-28 w-full" />)}
    </div>
  )
}

function OwnerDecisions({ cases, error, refresh }: { cases: StockCase[]; error: string | null; refresh: () => Promise<void> }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [action, setAction] = useState<Action | 'all'>('all')
  const [decider, setDecider] = useState('all')
  const [query, setQuery] = useState('')

  const decided = useMemo(
    () =>
      cases
        .filter((c): c is Decided => CLOSED_STATUSES.includes(c.status) && !!c.decision)
        .sort((a, b) => klSortValue(b.decision.at) - klSortValue(a.decision.at)),
    [cases],
  )
  const deciders = useMemo(() => Array.from(new Set(decided.map((c) => c.decision.by))).sort(), [decided])

  const fromBad = from !== '' && !isValidDateKey(from)
  const toBad = to !== '' && !isValidDateKey(to)
  const reversed = !fromBad && !toBad && from && to && from > to
  const dateProblem = fromBad || toBad || reversed
  const q = query.trim().toLowerCase()
  const filtersActive = !!(from || to || action !== 'all' || decider !== 'all' || q)

  const visible = dateProblem
    ? []
    : decided.filter((c) => {
        const key = klDateKey(c.decision.at)
        if ((from || to) && !key) return false
        if (from && key! < from) return false
        if (to && key! > to) return false
        if (action !== 'all' && c.decision.action !== action) return false
        if (decider !== 'all' && c.decision.by !== decider) return false
        if (q && ![c.product, c.id, c.decision.reason].some((s) => s.toLowerCase().includes(q))) return false
        return true
      })
  const overrides = visible.filter((c) => c.decision.action === 'overridden').length

  const reset = () => {
    setFrom(''); setTo(''); setAction('all'); setDecider('all'); setQuery('')
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Decisions" subtitle="Every closed case and the reason behind it, newest decision first." />
      <LockNote>Owner oversight is read-only. Nothing here changes stock or reopens a case.</LockNote>
      {error && <ErrorNotice title="Could not refresh decisions" description={`${error} Showing the last loaded data.`} onRetry={() => void refresh().catch(() => {})} />}

      <Card className="flex flex-col gap-4 p-4 md:p-5" aria-label="Filter decisions">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1.5 text-body-sm text-fg-secondary">
            Decided from
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={FIELD} aria-invalid={!!(fromBad || reversed)} data-testid="input-date-from" />
          </label>
          <label className="flex flex-col gap-1.5 text-body-sm text-fg-secondary">
            Decided to (inclusive)
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={FIELD} aria-invalid={!!(toBad || reversed)} data-testid="input-date-to" />
          </label>
          <label className="flex flex-col gap-1.5 text-body-sm text-fg-secondary">
            Decided by
            <select value={decider} onChange={(e) => setDecider(e.target.value)} className={cn(FIELD, 'border px-4 text-fg')} data-testid="select-decider">
              <option value="all">Anyone</option>
              {deciders.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-body-sm text-fg-secondary">
            Search
            <span className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-fg-tertiary" aria-hidden="true" />
              <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Product, ID or reason" className={cn(FIELD, 'pl-10')} data-testid="input-search-decisions" />
            </span>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Filter by action" className="flex flex-wrap gap-2">
            {ACTIONS.map((a) => (
              <button
                key={a.key}
                type="button"
                aria-pressed={action === a.key}
                onClick={() => setAction(a.key)}
                data-testid={`filter-action-${a.key}`}
                className={cn(
                  'min-h-11 rounded-full border px-4 text-body-sm font-medium transition-colors',
                  action === a.key ? 'border-accent-text bg-accent-fill/15 text-fg' : 'border-line text-fg-secondary hover:text-fg',
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={reset}
            disabled={!filtersActive}
            data-testid="button-reset-filters"
            className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-body-sm font-medium text-accent-text disabled:text-fg-tertiary"
          >
            <RotateCcw className="size-4" aria-hidden="true" /> Reset filters
          </button>
        </div>
        <p className="text-caption text-fg-tertiary">Dates use the decision time in Malaysia (Asia/Kuala_Lumpur), not when the case was created.</p>
        {dateProblem && (
          <p role="alert" className="text-body-sm font-medium text-danger" data-testid="text-date-error">
            {reversed ? 'The start date is after the end date. Adjust the range to see decisions.' : 'Enter a valid date. No decisions are shown until the range is valid.'}
          </p>
        )}
      </Card>

      {decided.length === 0 ? (
        <EmptyState icon={Scale} title="No decisions yet" description="When a manager approves, rejects or overrides a case, it appears here with its reason." />
      ) : dateProblem ? null : visible.length === 0 ? (
        <EmptyState
          icon={FileSearch}
          title="No decisions match these filters"
          description={`${decided.length} decision${decided.length === 1 ? '' : 's'} exist outside the current filters.`}
          action={<button type="button" onClick={reset} className={buttonVariants({ variant: 'secondary' })}>Reset filters</button>}
        />
      ) : (
        <section className="flex flex-col gap-3" aria-label="Decisions">
          <p className="text-body-sm text-fg-secondary" aria-live="polite" data-testid="text-decision-count">
            Showing <span className="num font-medium text-fg">{visible.length}</span> of <span className="num">{decided.length}</span> decisions
            {overrides > 0 && <> · <span className="num font-medium text-warning">{overrides}</span> override{overrides === 1 ? '' : 's'}</>}
          </p>
          <ul className="flex flex-col gap-3">
            {visible.map((c) => <DecisionRow key={c.id} c={c} />)}
          </ul>
        </section>
      )}
    </div>
  )
}

function DecisionRow({ c }: { c: Decided }) {
  const d = c.decision
  const { after, change } = outcome(c)
  const override = d.action === 'overridden'
  return (
    <li data-testid={`row-decision-${c.id}`}>
      <Card className={cn('flex flex-col gap-4 p-4 md:p-5', override && 'border-warning/50')}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="text-h3 font-semibold">{c.product}</h2>
            <p className="num text-caption text-fg-tertiary">{c.id}</p>
          </div>
          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-medium', ACTION_STYLE[d.action])}>
            {override && <ShieldAlert className="size-3.5" aria-hidden="true" />}
            {ACTION_LABEL[d.action]}
          </span>
        </div>
        {override && (
          <p className="text-body-sm text-warning">Override: the manager set the outcome directly instead of following the suggested conclusion. See the reason below.</p>
        )}
        <dl className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-0.5">
            <dt className="text-caption text-fg-tertiary">{d.action === 'rejected' ? 'Stock at decision (unchanged)' : 'Stock'}</dt>
            <dd className="num text-body font-medium">
              {d.action === 'rejected' ? after ?? 'Unknown' : c.recorded} <ArrowRight className="inline size-3.5 text-fg-tertiary" aria-label="to" />{' '}
              {after === null ? <span className="text-fg-secondary">Final stock unavailable</span> : after}
            </dd>
            {d.action === 'rejected' && <dd className="text-caption text-fg-tertiary">Recorded at count: {c.recorded}</dd>}
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-caption text-fg-tertiary">Stock change</dt>
            <dd className={cn('num text-body font-medium', change === null ? 'text-fg-secondary' : change === 0 ? 'text-fg-secondary' : 'text-fg')}>
              {change === null ? 'Unavailable' : change === 0 ? (d.action === 'rejected' ? '0 (record kept)' : '0') : formatSigned(change)}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-caption text-fg-tertiary">Decided</dt>
            <dd className="text-body-sm">{d.by} ({ROLE_INFO[d.role].label})</dd>
            <dd className="num text-caption text-fg-secondary">{formatKl(d.at)}</dd>
          </div>
        </dl>
        <div className="flex flex-col gap-3 border-t border-line pt-3 sm:flex-row sm:items-end sm:justify-between">
          <p className="line-clamp-2 max-w-[70ch] text-body-sm text-fg-secondary">
            <span className="font-medium text-fg">Reason: </span>
            {d.reason?.trim() ? d.reason : 'No reason recorded.'}
          </p>
          <Link href={`/history/${c.id}`} className={cn(buttonVariants({ variant: 'secondary' }), 'shrink-0 self-start')} data-testid={`link-passport-${c.id}`}>
            <Eye aria-hidden="true" /> View passport
          </Link>
        </div>
      </Card>
    </li>
  )
}
