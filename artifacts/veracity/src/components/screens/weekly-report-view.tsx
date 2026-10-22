import { Link, useLocation, useSearch } from 'wouter'
import { AlertTriangle, ArrowLeft, ArrowRight, ArrowUpRight, CheckCircle2, Lock, RefreshCw } from 'lucide-react'
import type { InventorySummaryReport } from '@workspace/api-client-react'
import { useApp } from '@/components/app/app-provider'
import { Card, EmptyState, ErrorNotice, PageHeader } from '@/components/veracity/primitives'
import { Button, buttonVariants } from '@/components/ui/button'
import { Pill } from '@/components/veracity/badges'
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
  const { role, loading: appLoading, error: appError, summary } = useApp()
  const allowed = role === 'manager' || role === 'owner'
  const params = new URLSearchParams(useSearch())
  const [, navigate] = useLocation()
  const productId = params.get('product')
  const selectedProduct = productId ? summary.items.find(item => item.productId === productId) : undefined
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
  if (productId) {
    return selectedProduct
      ? <ProductSummaryDetail item={selectedProduct} canViewSummary={allowed} />
      : <ErrorNotice title="Product not found" description="Refresh the stock summary and try again." />
  }
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

const signed = (n: number) => n > 0 ? `+${n}` : `${n}`

function ProductSummaryDetail({ item, canViewSummary }: { item: ReturnType<typeof useApp>['summary']['items'][number]; canViewSummary: boolean }) {
  const status = item.status === 'not_counted'
    ? <Pill tone="neutral" icon={AlertTriangle}>Not counted</Pill>
    : item.difference === 0
      ? <Pill tone="success" icon={CheckCircle2}>Matches</Pill>
      : item.difference! < 0
        ? <span className="inline-flex items-center gap-2 text-body-sm font-medium text-danger"><AlertTriangle className="size-4" aria-hidden="true" />Short by {Math.abs(item.difference!)}</span>
        : <span className="inline-flex items-center gap-2 text-body-sm font-medium text-accent-text"><ArrowUpRight className="size-4 text-fg-secondary" aria-hidden="true" />More by {item.difference}</span>
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Product summary" subtitle="Current counted quantity compared with the recorded stock.">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/count" className={buttonVariants({ variant: 'secondary' })}><ArrowLeft aria-hidden="true" />Back to count</Link>
          {canViewSummary && (
            <Link href="/reports" data-testid="button-back-to-summary" className={buttonVariants({ variant: 'secondary' })}>
              Back to summary<ArrowRight aria-hidden="true" />
            </Link>
          )}
        </div>
      </PageHeader>
      <Card className="flex flex-col gap-4" data-testid={`card-product-summary-${item.productId}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-h2 font-semibold">{item.name}</h2>
          {item.evidenceMissing && <Pill tone="warning" icon={AlertTriangle}>Evidence missing</Pill>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Metric label="Counted" value={item.counted ?? 0} note={item.counted === null ? 'No count submitted' : 'Latest observed quantity'} testid={`product-counted-${item.productId}`} />
          <Metric label="Recorded" value={item.recorded} note="Current inventory record" testid={`product-recorded-${item.productId}`} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-elevated p-3">
          <span className="text-body-sm text-fg-secondary">Difference</span>
          <div className="flex items-center gap-3"><span className="num text-h3 font-semibold">{item.difference === null ? '—' : signed(item.difference)}</span>{status}</div>
        </div>
        {item.caseId && <Link href={`/cases/${item.caseId}`} className="self-start text-body-sm font-medium text-accent-text underline-offset-4 hover:underline">View case {item.caseId} <ArrowRight className="inline size-4" aria-hidden="true" /></Link>}
      </Card>
    </div>
  )
}

function Metric({ label, value, note, tone = 'default', badge, testid }: { label: string; value: number; note: string; tone?: 'default' | 'warn'; badge?: string; testid: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-[16px] border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-caption font-medium text-fg-secondary">{label}</span>
        {badge && <span className="num rounded-full tint-warning px-2 py-0.5 text-[11px] font-semibold text-warning">{badge}</span>}
      </div>
      <span className={cn('num text-display leading-none font-semibold tracking-tight', tone === 'warn' && 'text-warning')} data-testid={`stat-${testid}`}>{value}</span>
      <span className="text-caption text-fg-tertiary">{note}</span>
    </div>
  )
}

const tooltipStyle = { background: 'var(--bg-elevated)', border: '1px solid var(--line)', borderRadius: 12, color: 'var(--text-primary)', fontSize: 12 }
