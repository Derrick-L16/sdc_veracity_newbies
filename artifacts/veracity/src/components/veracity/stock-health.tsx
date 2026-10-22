
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  ClipboardList,
  Clock,
  Info,
  Lock,
  PlayCircle,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'wouter'
import { useState } from 'react'
import { formatDateTime } from '@/lib/format'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { StatusBadge } from '@/components/veracity/badges'
import { Card, ErrorNotice } from '@/components/veracity/primitives'
import {
  SEGMENT_ORDER,
  formatRM,
  verifiedPercent,
  type SegmentKey,
  type StaffProgress,
  type StockSummary,
} from '@/lib/stock'
import { cn } from '@/lib/utils'

type Tone = 'success' | 'warning' | 'danger' | 'neutral'

const SEGMENT_META: Record<SegmentKey, { label: string; tone: Tone; icon: LucideIcon }> = {
  verified: { label: 'Verified', tone: 'success', icon: CheckCircle2 },
  awaiting: { label: 'Awaiting approval', tone: 'warning', icon: Clock },
  attention: { label: 'Needs attention', tone: 'danger', icon: AlertTriangle },
  not_counted: { label: 'Not counted', tone: 'neutral', icon: CircleDashed },
}

const TONE_TEXT: Record<Tone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  neutral: 'text-neutral',
}

const TONE_FILL: Record<Tone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  /* Grey segment also gets a stripe so it never relies on colour alone */
  neutral:
    'bg-neutral/40 bg-[repeating-linear-gradient(135deg,transparent_0_4px,var(--bg-surface)_4px_6px)]',
}

export const SEGMENT_LABEL = Object.fromEntries(SEGMENT_ORDER.map((k) => [k, SEGMENT_META[k].label])) as Record<
  SegmentKey,
  string
>

export type HealthState = 'ready' | 'loading' | 'error'

const HEIGHT = 'min-h-[40svh] md:min-h-[50svh]'
const GRID = 'md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-6'

/* ----------------------------------------------------------------------------------------------- */

function Ring({ value, label, compact }: { value: number; label: string; compact?: boolean }) {
  const r = 42
  const c = 2 * Math.PI * r
  return (
    <div className={cn('relative flex size-28 shrink-0 items-center justify-center', !compact && 'md:size-44')}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" className="stroke-elevated" />
        {value > 0 && (
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - value / 100)}
            className="stroke-success transition-[stroke-dashoffset] duration-700"
          />
        )}
      </svg>
      <span className={cn('num text-h1-sm font-semibold', !compact && 'md:text-display')}>{value}%</span>
      <span className="sr-only">{label}</span>
    </div>
  )
}

function InfoTip({ lines }: { lines: string[] }) {
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label="How this is calculated"
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-fg-tertiary transition-colors hover:bg-elevated hover:text-fg"
      >
        <Info className="size-4" aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent className="flex max-w-72 flex-col items-start gap-1 rounded-[12px] border border-line bg-elevated px-3 py-2 text-body-sm text-fg">
        {lines.map((l, i) => (
          <span key={l} className={i === 0 ? 'font-medium' : 'num text-fg-secondary'}>
            {l}
          </span>
        ))}
      </TooltipContent>
    </Tooltip>
  )
}

function SegmentBar({ counts, total }: { counts: Record<SegmentKey, number>; total: number }) {
  return (
    <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-elevated" aria-hidden="true">
      {SEGMENT_ORDER.map((k) =>
        counts[k] > 0 ? (
          <span
            key={k}
            className={cn('h-full first:rounded-l-full last:rounded-r-full', TONE_FILL[SEGMENT_META[k].tone])}
            style={{ width: `${(counts[k] / total) * 100}%` }}
          />
        ) : null,
      )}
    </div>
  )
}

function SegmentLegend({
  counts,
  selected,
  onSelect,
  labels,
  compact,
}: {
  counts: Record<SegmentKey, number>
  selected?: SegmentKey | null
  onSelect?: (key: SegmentKey | null) => void
  labels?: Partial<Record<SegmentKey, string>>
  compact?: boolean
}) {
  return (
    <ul className={cn('grid grid-cols-2 gap-2', !compact && 'lg:grid-cols-4')} aria-label="Items by status">
      {SEGMENT_ORDER.map((k) => {
        const meta = SEGMENT_META[k]
        const Icon = meta.icon
        const label = labels?.[k] ?? meta.label
        const active = selected === k
        const content = (
          <>
            <span className="flex items-center gap-1.5">
              <Icon className={cn('size-4 shrink-0', TONE_TEXT[meta.tone])} aria-hidden="true" />
              <span className="num text-h3 font-semibold">{counts[k]}</span>
            </span>
            <span className="text-caption text-fg-secondary md:text-body-sm">{label}</span>
          </>
        )
        const base = 'flex min-h-14 w-full flex-col items-start justify-center gap-0.5 rounded-[12px] border px-3 py-2 text-left'
        return (
          <li key={k}>
            {onSelect ? (
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(active ? null : k)}
                className={cn(
                  base,
                  'transition-colors',
                  active ? 'border-accent-text bg-accent-fill/15' : 'border-line bg-elevated hover:border-fg-tertiary',
                )}
              >
                {content}
                <span className="sr-only">{active ? ', filter on. Press to clear.' : ', filter the case list'}</span>
              </button>
            ) : (
              <div className={cn(base, 'border-line bg-elevated')}>{content}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/* ----------------------------------------------------------------------------------------------- */

function MissingPanel({ missing, compact }: { missing: StockSummary['missing']; compact?: boolean }) {
  const [open, setOpen] = useState(false)

  if (missing.units === 0) {
    return (
      <div className="flex flex-1 flex-col items-start justify-center gap-2 rounded-[12px] border border-line bg-elevated p-4 md:p-5">
        <CheckCircle2 className="size-6 text-success" aria-hidden="true" />
        <h3 className="text-h3 font-semibold">Nothing missing</h3>
        <p className="text-body-sm text-fg-secondary">Every counted item matches its record or has an approved difference.</p>
      </div>
    )
  }

  const explainedPct = (missing.explained / missing.value) * 100

  return (
    <section
      aria-labelledby="missing-title"
      className="flex flex-1 flex-col gap-4 rounded-[12px] border border-line bg-elevated p-4 md:p-5"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="missing-body"
        className={cn('flex items-start justify-between gap-3 text-left', !compact && 'md:pointer-events-none')}
      >
        <span className="flex flex-col gap-1">
          <span id="missing-title" className="text-body-sm font-medium text-fg-secondary">
            {"What's missing"}
          </span>
          <span className="num text-h2 font-semibold">
            {missing.units} units missing <span className="text-fg-secondary">≈</span> {formatRM(missing.value)}
          </span>
        </span>
        <ChevronDown
          className={cn('mt-1 size-5 shrink-0 text-fg-tertiary transition-transform', !compact && 'md:hidden', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      <div id="missing-body" className={cn('flex-col gap-4', open ? 'flex' : compact ? 'hidden' : 'hidden md:flex')}>
        <div className="flex flex-col gap-2">
          <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
            <span className="h-full rounded-l-full bg-success" style={{ width: `${explainedPct}%` }} />
            <span className="h-full flex-1 rounded-r-full bg-danger" />
          </div>
          <p className="num flex flex-wrap gap-x-3 gap-y-1 text-body-sm">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-success" aria-hidden="true" />
              {formatRM(missing.explained)} explained
            </span>
            <span className="text-fg-tertiary" aria-hidden="true">
              ·
            </span>
            <span className="inline-flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 text-danger" aria-hidden="true" />
              {formatRM(missing.unexplained)} unexplained
            </span>
          </p>
        </div>

        <ul className="flex flex-col divide-y divide-line" aria-label="Top missing items">
          {missing.items.slice(0, 3).map((item) => (
            <li key={item.caseId}>
              <Link
                href={`/cases/${item.caseId}`}
                className="flex items-center gap-3 py-3 transition-colors hover:text-accent-text"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-body font-medium">{item.name}</span>
                  <span className="num text-body-sm text-fg-secondary">
                    −{item.units} units · <span className="font-semibold text-fg">{formatRM(item.value)}</span>
                  </span>
                </span>
                <StatusBadge status={item.status} />
              </Link>
            </li>
          ))}
        </ul>

        <Link
          href="#case-list"
          className="self-start text-body-sm font-medium text-accent-text underline-offset-4 hover:underline"
        >
          View all
        </Link>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------------------------------------- */

export function StockHealth({
  state = 'ready',
  summary,
  selected,
  onSelect,
  onRetry,
  compact,
  className,
}: {
  state?: HealthState
  compact?: boolean
  summary: StockSummary
  selected?: SegmentKey | null
  onSelect?: (key: SegmentKey | null) => void
  onRetry?: () => void
  className?: string
}) {
  if (state === 'loading') return <StockHealthSkeleton className={className} />
  if (state === 'error') return <StockHealthError onRetry={onRetry} className={className} />

  const pct = verifiedPercent(summary)
  const { counts, total } = summary
  const noCount = summary.lastCount === null

  return (
    <Card aria-labelledby="health-title" className={cn('flex flex-col gap-5 md:p-6', HEIGHT, className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="health-title" className="text-h3 font-semibold">
          Stock health
        </h2>
        <InfoTip
          lines={[
            'Verified = counted and matching, or difference approved.',
            `Verified % = verified items ÷ registered items × 100`,
            `= ${counts.verified} ÷ ${total} × 100 = ${pct}%`,
          ]}
        />
      </div>

      {summary.inProgress && (
        <div className="flex flex-col gap-3 rounded-[12px] border border-accent-text/40 bg-accent-fill/10 p-4 sm:flex-row sm:items-center">
          <PlayCircle className="size-5 shrink-0 text-accent-text" aria-hidden="true" />
          <div className="flex flex-1 flex-col gap-2">
            <p className="text-body-sm">
              <span className="font-medium">Count in progress</span>
              <span className="text-fg-secondary">
                {' '}
                · <span className="num">{summary.inProgress.counted} of {summary.inProgress.total}</span> counted ·{' '}
                {summary.inProgress.by} started {summary.inProgress.startedAt}
              </span>
            </p>
            <div
              role="progressbar"
              aria-label="Count progress"
              aria-valuemin={0}
              aria-valuemax={summary.inProgress.total}
              aria-valuenow={summary.inProgress.counted}
              className="h-1.5 w-full overflow-hidden rounded-full bg-elevated"
            >
              <span
                className="block h-full rounded-full bg-accent-fill"
                style={{ width: `${(summary.inProgress.counted / summary.inProgress.total) * 100}%` }}
              />
            </div>
          </div>
          <Link href="/count" className={cn(buttonVariants({ variant: 'secondary' }), 'self-start sm:self-auto')}>
            Continue count
          </Link>
        </div>
      )}

      <div className={cn('grid flex-1 gap-5', !compact && GRID)}>
        <div className="flex flex-col justify-between gap-5">
          <div className="flex items-center gap-4 md:gap-6">
            <Ring value={pct} label={`${pct}% of stock verified`} compact={compact} />
            <div className="flex min-w-0 flex-col gap-1">
              <p className={cn('text-h3 font-semibold text-pretty', !compact && 'md:text-h2')}>
                Stock verified <span className="text-fg-tertiary">·</span>{' '}
                <span className="num">
                  {counts.verified} of {total}
                </span>{' '}
                items
              </p>
              <p className="text-body-sm text-fg-secondary">
                {noCount ? 'No count yet' : `Last count: ${formatDateTime(summary.lastCount ?? '')}`}
                {summary.inProgress ? ' · results update when submitted' : ''}
              </p>
              {noCount && (
                <Link href="/count" className={cn(buttonVariants({ size: 'lg' }), 'mt-2 self-start')}>
                  <ClipboardList aria-hidden="true" />
                  Start a count
                </Link>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <SegmentBar counts={counts} total={total} />
            <SegmentLegend counts={counts} selected={selected} onSelect={onSelect} compact={compact} />
          </div>
        </div>

        {noCount ? (
          <div className="flex flex-1 flex-col items-start justify-center gap-2 rounded-[12px] border border-dashed border-line p-4 md:p-5">
            <CircleDashed className="size-6 text-neutral" aria-hidden="true" />
            <h3 className="text-h3 font-semibold">Nothing to compare yet</h3>
            <p className="text-body-sm text-fg-secondary">
              After the first count, missing units and their value show up here.
            </p>
          </div>
        ) : (
          <MissingPanel missing={summary.missing} compact={compact} />
        )}
      </div>
    </Card>
  )
}

export function StaffHealth({ progress, className }: { progress: StaffProgress; className?: string }) {
  const pct = (progress.total ? Math.round((progress.counted / progress.total) * 100) : 0)
  const counts: Record<SegmentKey, number> = {
    verified: progress.matched,
    awaiting: 0,
    attention: progress.differ,
    not_counted: progress.total - progress.counted,
  }
  const remaining = progress.total - progress.counted

  return (
    <Card aria-labelledby="staff-health-title" className={cn('flex flex-col gap-5 md:p-6', HEIGHT, className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="staff-health-title" className="text-h3 font-semibold">
          Your count
        </h2>
        <InfoTip
          lines={[
            'Progress counts only the items you have counted.',
            'Progress % = items you counted ÷ registered items × 100',
            `= ${progress.counted} ÷ ${progress.total} × 100 = ${pct}%`,
          ]}
        />
      </div>

      <div className="grid flex-1 gap-5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-6">
        <div className="flex flex-col justify-between gap-5">
          <div className="flex items-center gap-4 md:gap-6">
            <Ring value={pct} label={`${pct}% of your count done`} />
            <div className="flex flex-col gap-1">
              <p className="text-h3 font-semibold md:text-h2">
                <span className="num">
                  {progress.counted} of {progress.total}
                </span>{' '}
                items counted
              </p>
              <p className="text-body-sm text-fg-secondary">
                {progress.lastSubmitted ? `Last submitted: ${formatDateTime(progress.lastSubmitted)}` : 'Not submitted yet'}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <SegmentBar counts={counts} total={progress.total} />
            <SegmentLegend
              counts={counts}
              labels={{ verified: 'Match', awaiting: 'Awaiting approval', attention: 'Differ', not_counted: 'Not counted' }}
            />
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center gap-4 rounded-[12px] border border-line bg-elevated p-4 md:p-5">
          <h3 className="text-h3 font-semibold">
            {remaining > 0 ? (
              <>
                <span className="num">{remaining}</span> items left to count
              </>
            ) : (
              'All items counted'
            )}
          </h3>
          <p className="text-body-sm text-fg-secondary">
            Items that differ open a case for a manager. You can follow them in the list below.
          </p>
          {remaining > 0 && (
            <Link href="/count" className={cn(buttonVariants({ size: 'lg' }), 'self-start')}>
              <ClipboardList aria-hidden="true" />
              Continue count
            </Link>
          )}
          <p className="flex items-start gap-2 text-caption text-fg-tertiary">
            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            Store-wide stock value is visible to managers.
          </p>
        </div>
      </div>
    </Card>
  )
}

function StockHealthSkeleton({ className }: { className?: string }) {
  return (
    <Card aria-busy="true" aria-label="Loading stock health" className={cn('flex flex-col gap-5 md:p-6', HEIGHT, className)}>
      <Skeleton className="h-6 w-32 bg-elevated" />
      <div className="grid flex-1 gap-5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-6">
        <div className="flex flex-col justify-between gap-5">
          <div className="flex items-center gap-4 md:gap-6">
            <Skeleton className="size-28 rounded-full bg-elevated md:size-44" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-7 w-3/4 bg-elevated" />
              <Skeleton className="h-4 w-1/3 bg-elevated" />
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <Skeleton className="h-3 w-full rounded-full bg-elevated" />
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 rounded-[12px] bg-elevated" />
              ))}
            </div>
          </div>
        </div>
        <Skeleton className="min-h-40 rounded-[12px] bg-elevated" />
      </div>
      <span className="sr-only">Loading stock health…</span>
    </Card>
  )
}

function StockHealthError({ onRetry, className }: { onRetry?: () => void; className?: string }) {
  return (
    <Card className={cn('flex flex-col justify-center gap-4 md:p-6', HEIGHT, className)}>
      <h2 className="text-h3 font-semibold">Stock health</h2>
      <ErrorNotice
        title="Couldn't load stock health."
        description="The case list below is still up to date. Try again in a moment."
        onRetry={onRetry ?? (() => {})}
      />
    </Card>
  )
}

/** Thin summary shown on mobile once the overview scrolls out of view. */
export function StockHealthBar({ summary, className }: { summary: StockSummary; className?: string }) {
  const pct = verifiedPercent(summary)
  return (
    <div
      className={cn(
        'flex h-11 items-center gap-3 border-b border-line bg-surface/95 px-4 text-body-sm backdrop-blur',
        className,
      )}
    >
      <span className="flex items-center gap-1.5 font-semibold">
        <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
        <span className="num">{pct}%</span> verified
      </span>
      {summary.counts.attention > 0 && (
        <span className="flex items-center gap-1.5 text-fg-secondary">
          <AlertTriangle className="size-4 text-danger" aria-hidden="true" />
          <span className="num">{summary.counts.attention}</span> need attention
        </span>
      )}
      {summary.missing.value > 0 && (
        <span className="num ml-auto font-medium">{formatRM(summary.missing.value)}</span>
      )}
    </div>
  )
}
