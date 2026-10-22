import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import type { InventorySummaryReport } from '@workspace/api-client-react'
import { Card } from '@/components/veracity/primitives'
import { bucketAxisLabel, bucketLongLabel, PERIOD_NOUN, plural, type ReportPeriod } from '@/lib/report-period'

const CYAN = '#61A9BD'
const CYAN_DARK = '#3C7686'
const UNIT: Record<ReportPeriod, string> = { daily: 'hour', weekly: 'day', monthly: 'day', yearly: 'month' }

export function ActivityChart({ report }: { report: InventorySummaryReport }) {
  const period = report.period as ReportPeriod
  const [active, setActive] = useState<number | null>(null)
  const data = useMemo(() => report.buckets.map((b, i) => ({
    i, ...b, label: bucketAxisLabel(period, b.start), value: b.future ? null : b.counts,
  })), [report.buckets, period])
  const elapsed = data.filter((d) => !d.future)
  const busiest = elapsed.reduce<(typeof data)[number] | null>((a, d) => (!a || d.counts > a.counts ? d : a), null)
  const summary = elapsed.length === 0
    ? `This ${PERIOD_NOUN[period]} has not started yet.`
    : `${plural(report.totals.countSubmissions, 'count')} over ${plural(elapsed.length, UNIT[period])}${busiest && busiest.counts > 0 ? `. Busiest: ${bucketLongLabel(period, busiest.start, busiest.end)} with ${busiest.counts}` : ''}.`
  const sel = active !== null ? data[active] : null
  const dense = data.length > 12

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-h3 font-semibold">Counts by {UNIT[period]}</h2>
        <p className="text-caption text-fg-tertiary">{summary}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_15rem]">
        <figure aria-label={`Bar chart of counts per ${UNIT[period]}. ${summary}`} className="h-56 min-w-0" onMouseLeave={() => setActive(null)}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 4, bottom: 0, left: -24 }}
              onMouseMove={(s: { activeTooltipIndex?: number | string | null }) => { const n = Number(s?.activeTooltipIndex); setActive(Number.isFinite(n) && s?.activeTooltipIndex != null ? n : null) }}
              onClick={(s: { activeTooltipIndex?: number | string | null }) => { const n = Number(s?.activeTooltipIndex); if (Number.isFinite(n) && s?.activeTooltipIndex != null) setActive(n) }}
            >
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} interval={dense ? 'preserveStartEnd' : 0} minTickGap={4} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} domain={[0, (max: number) => Math.max(max, 1)]} />
              <Bar dataKey="value" radius={[5, 5, 0, 0]} maxBarSize={40} isAnimationActive={false}>
                {data.map((d) => <Cell key={d.i} fill={active === null || active === d.i ? CYAN : CYAN_DARK} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </figure>
        <aside aria-live="polite" data-testid="panel-bucket-detail" className="flex flex-col gap-3 rounded-[14px] border border-line bg-elevated p-4 text-white">
          <p className="text-caption font-medium text-white">{sel ? 'Selected' : `Whole ${PERIOD_NOUN[period]}`}</p>
          <p className="num text-body font-semibold">{sel ? bucketLongLabel(period, sel.start, sel.end) : 'Hover or tap a bar for detail'}</p>
          {sel?.future ? (
            <p className="text-body-sm">Not reached yet.</p>
          ) : (
            <dl className="num grid gap-1.5 text-body-sm">
              <Row k="Counts" v={sel ? sel.counts : report.totals.countSubmissions} />
              <Row k="Opened" v={sel ? sel.newCases : report.totals.newCases} />
              <Row k="Closed" v={sel ? sel.closedCases : report.totals.closedCases} />
            </dl>
          )}
        </aside>
      </div>
      <div className="sr-only"><table>
        <caption>Activity by {UNIT[period]}</caption>
        <thead><tr><th>Period</th><th>Counts</th><th>Opened</th><th>Closed</th></tr></thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.i}><td>{bucketLongLabel(period, d.start, d.end)}</td>{d.future ? <td colSpan={3}>Not reached yet</td> : <><td>{d.counts}</td><td>{d.newCases}</td><td>{d.closedCases}</td></>}</tr>
          ))}
        </tbody>
      </table></div>
    </Card>
  )
}

function Row({ k, v }: { k: string; v: number }) {
  return <div className="flex justify-between gap-3"><dt className="text-white">{k}:</dt><dd className="font-semibold text-white">{v}</dd></div>
}
