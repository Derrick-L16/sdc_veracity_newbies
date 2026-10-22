import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DateInput } from '@/components/ui/date-input'
import { cn } from '@/lib/utils'
import { MIN_DATE, PERIODS, PERIOD_LABEL, PERIOD_NOUN, shiftPeriod, todayKL, type ReportPeriod } from '@/lib/report-period'

interface Props {
  period: ReportPeriod
  start: string
  isCurrent: boolean
  onPeriod: (p: ReportPeriod) => void
  onDate: (d: string | null) => void
}

export function PeriodPicker({ period, start, isCurrent, onPeriod, onDate }: Props) {
  const next = shiftPeriod(period, start, 1)
  const prev = shiftPeriod(period, start, -1)
  const noun = PERIOD_NOUN[period]
  return (
    <div className="flex flex-col gap-2 md:items-end">
      <div role="tablist" aria-label="Report period" className="inline-flex self-start rounded-full border border-line bg-surface p-1 md:self-end">
        {PERIODS.map((p) => (
          <button
            key={p}
            role="tab"
            type="button"
            aria-selected={p === period}
            data-testid={`tab-period-${p}`}
            onClick={() => onPeriod(p)}
            className={cn(
              'rounded-full px-3 py-1.5 text-body-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none',
              p === period ? 'bg-elevated text-fg' : 'text-fg-secondary hover:text-fg',
            )}
          >
            {PERIOD_LABEL[p]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`Choose ${noun}`}>
        <Button variant="secondary" size="icon" aria-label={`Previous ${noun}`} data-testid="button-prev-period" disabled={prev < MIN_DATE} onClick={() => onDate(prev)}>
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
        <label className="relative flex h-10 items-center rounded-full border border-line bg-surface px-3 text-body-sm">
          <span className="sr-only">Pick any date in the {noun}</span>
          <DateInput
            data-testid="input-period-date"
            value={start}
            min={MIN_DATE}
            max={todayKL()}
            onChange={(e) => { if (e.target.value) onDate(e.target.value) }}
            className="h-9 min-w-36 border-0 bg-transparent px-0 text-body-sm text-fg"
          />
        </label>
        <Button variant="secondary" size="icon" aria-label={`Next ${noun}`} data-testid="button-next-period" disabled={isCurrent || next > todayKL()} onClick={() => onDate(next)}>
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
        <Button variant="secondary" data-testid="button-current-period" disabled={isCurrent} onClick={() => onDate(null)} className="rounded-full">
          This {noun}
        </Button>
      </div>
    </div>
  )
}
