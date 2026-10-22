import type { WeeklyInventoryTotals } from '@workspace/api-client-react'
import { cn } from '@/lib/utils'
import { plural } from '@/lib/report-period'

export function ReportMetrics({ totals: t, live, noun }: { totals: WeeklyInventoryTotals; live: boolean; noun: string }) {
  const delta = t.closingBacklog - t.openingBacklog
  const change = delta === 0 ? 'no change' : delta > 0 ? `${delta} more` : `${-delta} fewer`
  return (
    <section aria-label="Period totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Metric label="Counts submitted" value={t.countSubmissions} note={`${plural(t.productsCounted, 'product')} counted`} testid="countSubmissions" />
      <Metric label="Cases opened" value={t.newCases} note="Counts that differed from records" testid="newCases" />
      <Metric label="Cases closed" value={t.closedCases} note={`Includes cases opened before this ${noun}`} testid="closedCases" />
      <Metric
        label={live ? 'Still open' : `Open at ${noun} end`}
        value={t.closingBacklog}
        note={`Open at start: ${t.openingBacklog} (${change})`}
        tone={t.overdueCases > 0 ? 'warn' : 'default'}
        badge={t.overdueCases > 0 ? `${t.overdueCases} open 7+ days` : undefined}
        testid="closingBacklog"
      />
    </section>
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
