import { AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react'
import { formatSigned } from '@/lib/format'
import { cn } from '@/lib/utils'

export function DiscrepancyBar({
  recorded,
  counted,
  explained,
}: {
  recorded: number
  counted: number
  /** Unsigned number of explained units; sign follows the difference. */
  explained: number
}) {
  const diff = counted - recorded
  const signedExplained = diff < 0 ? -explained : explained
  const expected = recorded + signedExplained
  const gap = Math.abs(counted - expected)
  const matches = gap === 0

  const steps = [
    { label: 'Recorded', value: String(recorded) },
    { label: 'Explained', value: formatSigned(signedExplained) },
    { label: 'Expected', value: String(expected) },
  ]

  return (
    <div className="flex flex-col gap-3 rounded-[12px] border border-line bg-elevated p-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
        {steps.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2">
            <div className="flex flex-col">
              <span className="text-caption font-medium tracking-[0.04em] text-fg-secondary uppercase">{s.label}</span>
              <span className="num text-h2 font-semibold">{s.value}</span>
            </div>
            {i < steps.length - 1 && <ArrowRight className="size-4 text-fg-tertiary" aria-hidden="true" />}
          </div>
        ))}
        <div className="mx-1 h-10 w-px bg-line" aria-hidden="true" />
        <div className="flex flex-col">
          <span className="text-caption font-medium tracking-[0.04em] text-fg-secondary uppercase">Counted</span>
          <span className="num text-h2 font-semibold">{counted}</span>
        </div>
      </div>
      <p
        className={cn(
          'flex items-center gap-2 text-body-sm font-medium',
          matches ? 'text-success' : 'text-warning',
        )}
      >
        {matches ? (
          <CheckCircle2 className="size-4" aria-hidden="true" />
        ) : (
          <AlertCircle className="size-4" aria-hidden="true" />
        )}
        {matches
          ? 'Matches. Expected stock equals the count.'
          : `Does not match. ${gap} ${gap === 1 ? 'unit is' : 'units are'} still unexplained.`}
      </p>
    </div>
  )
}

export function CoverageGauge({
  explained,
  total,
  className,
}: {
  explained: number
  total: number
  className?: string
}) {
  const pct = total === 0 ? 100 : Math.min(100, Math.round((explained / total) * 100))
  const unexplained = Math.max(0, total - explained)
  const full = unexplained === 0
  const tone = full ? 'var(--status-success)' : 'var(--status-warning)'

  return (
    <div
      className={cn('flex flex-col items-center gap-2 rounded-[12px] border border-line bg-elevated p-4', className)}
    >
      <div className="relative w-full max-w-[220px]">
        <svg viewBox="0 0 200 110" className="w-full" aria-hidden="true">
          <path
            d="M 16 100 A 84 84 0 0 1 184 100"
            fill="none"
            stroke="var(--line)"
            strokeWidth="16"
            strokeLinecap="round"
          />
          <path
            d="M 16 100 A 84 84 0 0 1 184 100"
            fill="none"
            stroke={tone}
            strokeWidth="16"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${pct} 100`}
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
          <span className="num text-display font-semibold">{pct}%</span>
        </div>
      </div>
      <p className="text-center text-body font-medium">
        <span className="num">
          {explained} of {total}
        </span>{' '}
        units explained
      </p>
      <p
        className={cn(
          'flex items-center gap-1.5 text-body-sm font-medium',
          full ? 'text-success' : 'text-warning',
        )}
      >
        {full ? (
          <CheckCircle2 className="size-4" aria-hidden="true" />
        ) : (
          <AlertCircle className="size-4" aria-hidden="true" />
        )}
        {full ? 'Fully explained' : <span className="num">{unexplained} unexplained</span>}
      </p>
    </div>
  )
}
