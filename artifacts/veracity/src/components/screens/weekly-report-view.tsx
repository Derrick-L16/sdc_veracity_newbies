import { useLocation, useSearch } from 'wouter'
import { Lock, RefreshCw } from 'lucide-react'
import type { InventorySummaryReport } from '@workspace/api-client-react'
import { useApp } from '@/components/app/app-provider'
import { EmptyState, ErrorNotice, PageHeader } from '@/components/veracity/primitives'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PeriodPicker } from '@/components/reports/period-picker'
import { ReportMetrics } from '@/components/reports/report-metrics'
import { ActivityChart } from '@/components/reports/activity-chart'
import { DecisionPanel } from '@/components/reports/decision-panel'
import { FollowUps } from '@/components/reports/follow-ups'
import { cn } from '@/lib/utils'
import { formatKl } from '@/lib/kl-time'
import { currentStart, isPeriod, normalizeDate, PERIOD_NOUN, periodTitle, plural, type ReportPeriod } from '@/lib/report-period'
import { useInventoryReport } from '@/hooks/use-inventory-report'

export function WeeklyReportView() {
  const { role, loading: appLoading, error: appError } = useApp()
  const allowed = role === 'manager' || role === 'owner'
  const params = new URLSearchParams(useSearch())
  const [, navigate] = useLocation()
  const rawPeriod = params.get('period')
  const period: ReportPeriod = isPeriod(rawPeriod) ? rawPeriod : 'weekly'
  const { date, error: dateError } = normalizeDate(period, params.get('date') ?? params.get('week'))
  const enabled = !appLoading && !appError && allowed
  const r = useInventoryReport(period, date, enabled, role ?? '')
  const start = date ?? currentStart(period)
  const noun = PERIOD_NOUN[period]

  const go = (p: ReportPeriod, d: string | null) => {
    const n = d ? normalizeDate(p, d).date : null
    const q = new URLSearchParams()
    if (p !== 'weekly') q.set('period', p)
    if (n) q.set('date', n)
    const s = q.toString()
    navigate(s ? `/reports?${s}` : '/reports')
  }

  if (appLoading) return <ReportSkeleton />
  if (!allowed) {
    return <EmptyState icon={Lock} title="Managers and owners only" description="Summaries include decisions and backlog across the store. Switch to a manager or owner role to view them." />
  }
  if (appError) return <ErrorNotice title="Session unavailable" description={appError} />

  return (
    <div className="flex flex-col gap-6" data-testid="page-weekly-report">
      <PageHeader title="Summary" subtitle="Count activity, decisions and the investigations still open, in Malaysia time.">
        <PeriodPicker period={period} start={start} isCurrent={date === null} onPeriod={(p) => go(p, date ? start : null)} onDate={(d) => go(period, d)} />
      </PageHeader>

      {dateError && <p role="status" className="rounded-[12px] border border-line bg-elevated px-4 py-3 text-body-sm text-fg-secondary">{dateError}</p>}
      {rawPeriod && !isPeriod(rawPeriod) && <p role="status" className="rounded-[12px] border border-line bg-elevated px-4 py-3 text-body-sm text-fg-secondary">Unknown period. Showing weekly.</p>}

      {r.error ? (
        <ErrorNotice title={`Could not load the ${noun} of ${periodTitle(period, start, start)}`} description={r.error} onRetry={r.retry} />
      ) : r.loading || !r.report ? (
        <ReportSkeleton />
      ) : (
        <ReportBody report={r.report} refreshing={r.refreshing} refreshError={r.refreshError} onRetry={r.retry} />
      )}
    </div>
  )
}

function ReportBody({ report, refreshing, refreshError, onRetry }: { report: InventorySummaryReport; refreshing: boolean; refreshError: string | null; onRetry: () => void }) {
  const period = report.period as ReportPeriod
  const noun = PERIOD_NOUN[period]
  const t = report.totals
  const live = report.snapshotKind === 'live'
  const quiet = t.countSubmissions === 0 && t.newCases === 0 && t.closedCases === 0

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-body-sm text-fg-secondary" data-testid="text-report-meta">
        <span className="num text-h3 font-semibold text-fg">{periodTitle(period, report.periodStart.slice(0, 10), report.periodEnd.slice(0, 10))}</span>
        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-caption font-semibold', live ? 'tint-accent-text text-accent-text' : 'tint-neutral text-fg-secondary')}>
          {live && <span className="size-1.5 rounded-full bg-accent-text" aria-hidden="true" />}
          {live ? 'Live, refreshes every 30 seconds' : report.isFinal ? `Closed ${noun}, saved snapshot` : 'Saved snapshot'}
        </span>
        <span className="num">As of {formatKl(report.asOf)}</span>
        {refreshing && <RefreshCw className="size-3.5 animate-spin text-fg-tertiary" aria-label="Refreshing" />}
      </div>

      {refreshError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-warning/40 tint-warning px-4 py-3 text-body-sm">
          <span><span className="font-semibold text-warning">Refresh failed.</span> Figures below are as of {formatKl(report.asOf)}. {refreshError}</span>
          <Button size="sm" variant="secondary" onClick={onRetry} data-testid="button-retry-refresh">Retry</Button>
        </div>
      )}

      {quiet && (
        <p className="rounded-[12px] border border-line bg-elevated px-4 py-3 text-body-sm text-fg-secondary" data-testid="text-quiet-period">
          No counts were submitted and no cases opened or closed this {noun}.
          {t.closingBacklog > 0 ? ` ${plural(t.closingBacklog, 'investigation')} from earlier still ${t.closingBacklog === 1 ? 'needs' : 'need'} a decision.` : ' Nothing is outstanding.'}
        </p>
      )}

      <ReportMetrics totals={t} live={live} noun={noun} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.7fr_1fr]">
        <ActivityChart report={report} />
        <DecisionPanel decisions={report.decisions} noun={noun} />
      </div>

      <FollowUps report={report} noun={noun} />

      {report.notes.length > 0 && (
        <p className="text-caption text-fg-tertiary" aria-label="Report notes">{report.notes.join(' ')}</p>
      )}
      <p className="num text-caption text-fg-tertiary">Generated {formatKl(report.generatedAt)}.</p>
    </div>
  )
}

function ReportSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading summary">
      <Skeleton className="h-6 w-64" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-[16px]" />)}</div>
      <div className="grid gap-5 xl:grid-cols-[1.7fr_1fr]"><Skeleton className="h-72 rounded-[20px]" /><Skeleton className="h-72 rounded-[20px]" /></div>
      <Skeleton className="h-48 rounded-[20px]" />
    </div>
  )
}
