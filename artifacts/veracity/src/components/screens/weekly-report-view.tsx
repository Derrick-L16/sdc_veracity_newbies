import { useMemo, useState } from 'react'
import { Link, useLocation, useSearch } from 'wouter'
import { AlertTriangle, ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Lock, RefreshCw } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { WeeklyInventoryFollowUp, WeeklyInventoryReport } from '@workspace/api-client-react'
import { useApp } from '@/components/app/app-provider'
import { Card, EmptyState, ErrorNotice, PageHeader } from '@/components/veracity/primitives'
import { Pill } from '@/components/veracity/badges'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { REPORT_TZ, currentMondayKL, normalizeWeek, shiftWeek, todayKL, useWeeklyReport } from '@/hooks/use-weekly-report'

const C = { cyan: '#61A9BD', yellow: '#CED14E', green: '#44986D', pink: '#DD83C9', blue: '#1F74AD', orange: '#E98E2E', purple: '#9267C6' }
const DECISION_COLORS = { approved: C.cyan, overridden: C.yellow, rejected: C.pink }
const STATUS_LABEL: Record<WeeklyInventoryFollowUp['status'], string> = {
  pending_approval: 'Awaiting approval',
  needs_review: 'Needs review',
  manual_review: 'Manual review',
}

const fmtDay = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', ...opts })
const fmtRange = (a: string, b: string) => `${fmtDay(a, { day: 'numeric', month: 'short' })} – ${fmtDay(b, { day: 'numeric', month: 'short', year: 'numeric' })}`
const fmtStamp = (iso: string) => new Date(iso).toLocaleString('en-GB', { timeZone: REPORT_TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`)
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

export function WeeklyReportView() {
  const { role, loading: appLoading, error: appError, summary } = useApp()
  const allowed = role === 'manager' || role === 'owner'
  const search = useSearch()
  const [, navigate] = useLocation()
  const raw = new URLSearchParams(search).get('week')
  const productId = new URLSearchParams(search).get('product')
  const selectedProduct = productId ? summary.items.find(item => item.productId === productId) : undefined
  const { week, error: weekError } = normalizeWeek(raw)
  const enabled = !appLoading && !appError && allowed
  const r = useWeeklyReport(week, enabled, role)
  const displayMonday = week ?? currentMondayKL()

  const go = (w: string | null) => navigate(w && w !== currentMondayKL() ? `/reports?week=${w}` : '/reports')

  if (appLoading) return <ReportSkeleton />
  if (appError) return <ErrorNotice title="Session unavailable" description={appError} />
  if (productId) {
    return selectedProduct
      ? <ProductSummaryDetail item={selectedProduct} />
      : <div className="flex flex-col gap-4"><ErrorNotice title="Product not found" description="Refresh the stock summary and try again." /><Link href="/count" className="self-start text-body-sm font-medium text-accent-text underline">Back to count</Link></div>
  }
  if (!allowed) {
    return (
      <EmptyState
        icon={Lock}
        title="Managers and owners only"
        description="Weekly summaries include decisions and backlog across the store. Switch to a manager or owner role to view them."
      />
    )
  }
  return (
    <div className="flex flex-col gap-6" data-testid="page-weekly-report">
      <PageHeader title="Weekly summary" subtitle="Count activity, decisions and the investigations still open, by week in Kuala Lumpur time.">
        <WeekPicker monday={displayMonday} isCurrent={week === null} onChange={go} />
      </PageHeader>

      {weekError && <p role="status" className="rounded-[12px] border border-line bg-elevated px-4 py-3 text-body-sm text-fg-secondary">{weekError}</p>}

      {r.error ? (
        <ErrorNotice title={`Could not load the week of ${fmtDay(displayMonday, { day: 'numeric', month: 'short' })}`} description={r.error} onRetry={r.retry} />
      ) : r.loading || !r.report ? (
        <ReportSkeleton />
      ) : (
        <ReportBody report={r.report} refreshing={r.refreshing} refreshError={r.refreshError} onRetry={r.retry} />
      )}
    </div>
  )
}

function ProductSummaryDetail({ item }: { item: ReturnType<typeof useApp>['summary']['items'][number] }) {
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
        <Link href="/count" className={buttonVariants({ variant: 'secondary' })}><ArrowLeft aria-hidden="true" />Back to count</Link>
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

function WeekPicker({ monday, isCurrent, onChange }: { monday: string; isCurrent: boolean; onChange: (w: string | null) => void }) {
  const next = shiftWeek(monday, 1)
  const nextIsFuture = next > todayKL()
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Choose week">
      <Button variant="secondary" size="icon" aria-label="Previous week" data-testid="button-prev-week" disabled={monday <= '2000-01-03'} onClick={() => onChange(shiftWeek(monday, -1))}>
        <ChevronLeft className="size-4" aria-hidden="true" />
      </Button>
      <label className="relative flex h-10 items-center gap-2 rounded-full border border-line bg-surface pr-3 pl-3 text-body-sm">
        <CalendarDays className="size-4 text-fg-tertiary" aria-hidden="true" />
        <span className="sr-only">Pick any date in a week</span>
        <input
          type="date"
          data-testid="input-week-date"
          value={monday}
          min="2000-01-03"
          max={todayKL()}
          onChange={(e) => { if (e.target.value) onChange(normalizeWeek(e.target.value).week) }}
          className="num bg-transparent text-body-sm text-white outline-none [color-scheme:inherit]"
        />
      </label>
      <Button variant="secondary" size="icon" aria-label="Next week" data-testid="button-next-week" disabled={isCurrent || nextIsFuture} onClick={() => onChange(next)}>
        <ChevronRight className="size-4" aria-hidden="true" />
      </Button>
      <Button variant="secondary" data-testid="button-current-week" disabled={isCurrent} onClick={() => onChange(null)} className="rounded-full">
        This week
      </Button>
    </div>
  )
}

function ReportBody({ report, refreshing, refreshError, onRetry }: { report: WeeklyInventoryReport; refreshing: boolean; refreshError: string | null; onRetry: () => void }) {
  const t = report.totals
  const live = report.snapshotKind === 'live'
  const oldest = report.followUps.reduce<WeeklyInventoryFollowUp | null>((a, f) => (!a || f.ageDays > a.ageDays ? f : a), null)
  const quiet = t.countSubmissions === 0 && t.newCases === 0 && t.closedCases === 0
  const backlogDelta = t.closingBacklog - t.openingBacklog

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-body-sm text-fg-secondary" data-testid="text-report-meta">
        <span className="text-h3 font-semibold text-fg">{fmtRange(report.weekStart, report.weekEnd)}</span>
        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-caption font-semibold', live ? 'tint-accent-text text-accent-text' : 'tint-neutral text-fg-secondary')}>
          {live && <span className="size-1.5 rounded-full bg-accent-text" aria-hidden="true" />}
          {live ? 'Live · refreshes every 30s' : report.isFinal ? 'Closed week · saved snapshot' : 'Saved snapshot'}
        </span>
        <span className="num">As of {fmtStamp(report.asOf)} ({report.timezone})</span>
        {refreshing && <RefreshCw className="size-3.5 animate-spin text-fg-tertiary" aria-label="Refreshing" />}
      </div>

      {refreshError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-warning/40 tint-warning px-4 py-3 text-body-sm">
          <span><span className="font-semibold text-warning">Refresh failed.</span> Figures below are as of {fmtStamp(report.asOf)}. {refreshError}</span>
          <Button size="sm" variant="secondary" onClick={onRetry} data-testid="button-retry-refresh">Retry</Button>
        </div>
      )}

      {quiet && (
        <p className="rounded-[12px] border border-line bg-elevated px-4 py-3 text-body-sm text-fg-secondary" data-testid="text-quiet-week">
          No counts were submitted and no cases opened or closed this week.
          {t.closingBacklog > 0 ? ` ${plural(t.closingBacklog, 'investigation')} from earlier weeks still ${t.closingBacklog === 1 ? 'needs' : 'need'} a decision.` : ' Nothing is outstanding.'}
        </p>
      )}

      <section aria-label="Week totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Counts submitted" value={t.countSubmissions} note={`${plural(t.productsCounted, 'product')} counted`} testid="countSubmissions" />
        <Metric label="Cases opened" value={t.newCases} note="Counts that differed from records" testid="newCases" />
        <Metric label="Cases closed" value={t.closedCases} note="Includes decisions on older cases" testid="closedCases" />
        <Metric
          label={live ? 'Still open' : 'Open at week end'}
          value={t.closingBacklog}
          note={`Started at ${t.openingBacklog} · ${backlogDelta === 0 ? 'no change' : signed(backlogDelta)}`}
          tone={t.overdueCases > 0 ? 'warn' : 'default'}
          badge={t.overdueCases > 0 ? `${t.overdueCases} aged 7+ days` : undefined}
          testid="closingBacklog"
        />
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.6fr_1fr]">
        <DailyChart report={report} />
        <DecisionChart report={report} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.6fr]">
        <Card className="flex flex-col gap-4">
          <h2 className="text-h3 font-semibold">Discrepancies observed</h2>
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-[12px] bg-elevated p-3">
              <dt className="text-caption text-fg-tertiary">Short of record</dt>
              <dd className="num text-h2 font-semibold" style={{ color: C.orange }} data-testid="text-shortage-units">{report.discrepancies.shortageUnits} <span className="text-body-sm font-normal text-fg-secondary">units</span></dd>
            </div>
            <div className="rounded-[12px] bg-elevated p-3">
              <dt className="text-caption text-fg-tertiary">Over record</dt>
              <dd className="num text-h2 font-semibold" style={{ color: C.blue }} data-testid="text-surplus-units">{report.discrepancies.surplusUnits} <span className="text-body-sm font-normal text-fg-secondary">units</span></dd>
            </div>
          </dl>
          <p className="text-caption text-fg-tertiary">Sum of differences across this week's cases. A product recounted several times is counted each time, so this is not net stock change.</p>
          {report.notes.length > 0 && (
            <ul className="flex flex-col gap-1.5 border-t border-line pt-3 text-body-sm text-fg-secondary" aria-label="Report notes">
              {report.notes.map((n, i) => <li key={i} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-fg-tertiary" aria-hidden="true" />{n}</li>)}
            </ul>
          )}
        </Card>

        <FollowUps report={report} oldest={oldest} />
      </div>

      <p className="text-caption text-fg-tertiary">Generated {fmtStamp(report.generatedAt)}. Counts that matched records are included in counts submitted but open no case.</p>
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

function DailyChart({ report }: { report: WeeklyInventoryReport }) {
  const data = report.daily.map((d) => ({ ...d, label: fmtDay(d.date, { weekday: 'short' }), value: d.future ? null : d.counts }))
  const elapsed = report.daily.filter((d) => !d.future)
  const busiest = elapsed.reduce<typeof elapsed[number] | null>((a, d) => (!a || d.counts > a.counts ? d : a), null)
  const summary = elapsed.length === 0
    ? 'No days of this week have started yet.'
    : `${report.totals.countSubmissions} counts over ${plural(elapsed.length, 'day')}${busiest && busiest.counts > 0 ? `; busiest ${fmtDay(busiest.date, { weekday: 'long' })} with ${busiest.counts}` : ''}.`
  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h2 className="text-h3 font-semibold">Counts by day</h2>
        <p className="text-caption text-fg-tertiary">{summary}</p>
      </div>
      <figure aria-label={`Bar chart of counts per day. ${summary}`} className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 4, bottom: 0, left: -24 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} domain={[0, (max: number) => Math.max(max, 1)]} />
            <Tooltip
              cursor={{ fill: 'var(--bg-elevated)' }}
              contentStyle={tooltipStyle}
              formatter={function (_v: unknown, _n: unknown, item: { payload?: (typeof data)[number] }) {
                const p = item?.payload
                if (!p) return ['', '']
                return p.future ? ['Not reached yet', fmtDay(p.date, { day: 'numeric', month: 'short' })] : [`${p.counts} counts · ${p.newCases} opened · ${p.closedCases} closed`, fmtDay(p.date, { day: 'numeric', month: 'short' })]
              }}
              labelFormatter={() => ''}
              separator=""
            />
            <Bar dataKey="value" fill={C.cyan} radius={[6, 6, 0, 0]} maxBarSize={44} isAnimationActive={false}>
              <LabelList dataKey="value" position="top" fill="var(--text-secondary)" fontSize={12} className="num" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </figure>
      <div className="sr-only"><table>
        <caption>Daily activity</caption>
        <thead><tr><th>Day</th><th>Counts</th><th>Cases opened</th><th>Cases closed</th></tr></thead>
        <tbody>
          {report.daily.map((d) => (
            <tr key={d.date}><td>{fmtDay(d.date, { weekday: 'long', day: 'numeric', month: 'short' })}</td>{d.future ? <td colSpan={3}>Not reached yet</td> : <><td>{d.counts}</td><td>{d.newCases}</td><td>{d.closedCases}</td></>}</tr>
          ))}
        </tbody>
      </table></div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-fg-tertiary" aria-hidden="true">
        {report.daily.map((d) => (
          <span key={d.date} className="num">{d.future ? 'upcoming' : d.newCases || d.closedCases ? `+${d.newCases} / -${d.closedCases}` : '·'}</span>
        ))}
      </div>
      <p className="text-caption text-fg-tertiary" aria-hidden="true">Under each day: cases opened / closed.</p>
    </Card>
  )
}

function DecisionChart({ report }: { report: WeeklyInventoryReport }) {
  const d = report.decisions
  const parts = useMemo(() => [
    { key: 'approved', name: 'Approved', value: d.approved, color: DECISION_COLORS.approved },
    { key: 'overridden', name: 'Overridden', value: d.overridden, color: DECISION_COLORS.overridden },
    { key: 'rejected', name: 'Rejected', value: d.rejected, color: DECISION_COLORS.rejected },
  ], [d.approved, d.overridden, d.rejected])
  const total = d.approved + d.overridden + d.rejected
  const [active, setActive] = useState<string | null>(null)
  const summary = total === 0 ? 'No decisions were recorded this week.' : parts.map((p) => `${p.value} ${p.name.toLowerCase()}`).join(', ') + ` of ${total}.`
  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h2 className="text-h3 font-semibold">Decisions</h2>
        <p className="text-caption text-fg-tertiary">{summary}</p>
      </div>
      <div className="flex items-center gap-4">
        <figure className="relative size-36 shrink-0" aria-label={`Donut chart of decision outcomes. ${summary}`}>
          {total === 0 ? (
            <div className="flex size-full items-center justify-center rounded-full border-[14px] border-elevated" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={parts.filter((p) => p.value > 0)} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="100%" paddingAngle={total > 1 ? 2 : 0} stroke="none" isAnimationActive={false}
                  onMouseEnter={(_: unknown, i: number) => setActive(parts.filter((p) => p.value > 0)[i]?.key ?? null)} onMouseLeave={() => setActive(null)}>
                  {parts.filter((p) => p.value > 0).map((p) => <Cell key={p.key} fill={p.color} opacity={active && active !== p.key ? 0.45 : 1} />)}
                </Pie>
                <Tooltip content={<DecisionTooltip total={total} />} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <figcaption className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="num text-h1 font-semibold" data-testid="text-decisions-total">{total}</span>
            <span className="text-caption text-fg-tertiary">decided</span>
          </figcaption>
        </figure>
        <ul className="flex flex-1 flex-col gap-2" aria-label="Decision breakdown">
          {parts.map((p) => (
            <li key={p.key} className="flex items-center gap-2 text-body-sm" onMouseEnter={() => setActive(p.key)} onMouseLeave={() => setActive(null)}>
              <span className="size-2.5 rounded-sm" style={{ background: p.color }} aria-hidden="true" />
              <span className="flex-1 text-fg-secondary" style={active === p.key ? { color: p.color } : undefined}>{p.name}</span>
              <span className="num font-semibold" data-testid={`text-decisions-${p.key}`} style={active === p.key ? { color: p.color } : undefined}>{p.value}</span>
              <span className="num w-10 text-right text-caption text-fg-tertiary" style={active === p.key ? { color: p.color } : undefined}>{total ? `${Math.round((p.value / total) * 100)}%` : '–'}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-caption text-fg-tertiary">Overridden: manager chose a different outcome than suggested.</p>
    </Card>
  )
}

function DecisionTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean
  payload?: Array<{ payload?: { name?: string; value?: number; color?: string } }>
  total: number
}) {
  const item = payload?.[0]?.payload
  if (!active || !item?.name || typeof item.value !== 'number') return null

  const color = item.color ?? 'var(--text-primary)'
  return (
    <div className="rounded-[12px] border bg-elevated px-3 py-2 text-center shadow-lg" style={{ borderColor: color, color }}>
      <p className="text-caption font-medium">{item.name}</p>
      <p className="num text-body-sm font-semibold">{item.value} ({Math.round((item.value / total) * 100)}%)</p>
    </div>
  )
}

function FollowUps({ report, oldest }: { report: WeeklyInventoryReport; oldest: WeeklyInventoryFollowUp | null }) {
  const items = [...report.followUps].sort((a, b) => b.ageDays - a.ageDays)
  const historical = report.isFinal || report.snapshotKind === 'saved'
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-h3 font-semibold">Still open at {historical ? 'week end' : 'this moment'}</h2>
          <p className="text-caption text-fg-tertiary">
            {items.length === 0 ? 'No investigations outstanding.' : `${plural(items.length, 'case')}, oldest first.`}
            {oldest && oldest.ageDays >= 7 && <span className="text-warning"> Oldest has waited {oldest.ageDays} days.</span>}
          </p>
        </div>
      </div>
      {historical && items.length > 0 && (
        <p className="rounded-[10px] bg-elevated px-3 py-2 text-caption text-fg-secondary">Listed as of {fmtStamp(report.asOf)}. Links open each case as it stands today, which may since have been decided.</p>
      )}
      {items.length === 0 ? (
        <p className="py-6 text-center text-body-sm text-fg-tertiary">Backlog clear.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line" aria-label="Outstanding cases">
          {items.map((f) => (
            <li key={f.id}>
              <Link href={`/cases/${f.id}`} data-testid={`link-case-${f.id}`} className="group flex items-center gap-3 rounded-[10px] px-2 py-2.5 hover:bg-elevated">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body-sm font-medium">{f.product}</span>
                  <span className="text-caption text-fg-tertiary"><span className="num">{f.id}</span> · {STATUS_LABEL[f.status]}</span>
                </div>
                <span className="num hidden text-caption text-fg-tertiary sm:block">{f.recorded} rec · {f.counted} cnt</span>
                <span className="num w-12 text-right text-body-sm font-semibold" style={{ color: f.difference < 0 ? C.orange : f.difference > 0 ? C.blue : undefined }}>{signed(f.difference)}</span>
                <span className={cn('num w-14 rounded-full px-2 py-0.5 text-center text-caption font-semibold', f.ageDays >= 7 ? 'tint-warning text-warning' : 'bg-elevated text-fg-secondary')}>{f.ageDays}d</span>
                <ArrowRight className="size-4 text-fg-tertiary transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function ReportSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading weekly summary">
      <Skeleton className="h-6 w-64" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-[16px]" />)}</div>
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]"><Skeleton className="h-72 rounded-[20px]" /><Skeleton className="h-72 rounded-[20px]" /></div>
    </div>
  )
}
