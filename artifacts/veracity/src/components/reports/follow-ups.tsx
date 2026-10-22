import { Link } from 'wouter'
import { ArrowRight } from 'lucide-react'
import type { InventorySummaryReport, WeeklyInventoryFollowUp } from '@workspace/api-client-react'
import { Card } from '@/components/veracity/primitives'
import { cn } from '@/lib/utils'
import { formatKl, klSortValue } from '@/lib/kl-time'
import { plural } from '@/lib/report-period'

const STATUS_LABEL: Record<WeeklyInventoryFollowUp['status'], string> = {
  pending_approval: 'Awaiting approval',
  needs_review: 'Needs review',
  manual_review: 'Manual review',
}

function differenceText(diff: number) {
  if (diff === 0) return 'No difference'
  return `${Math.abs(diff)} ${diff < 0 ? 'fewer' : 'more'} ${Math.abs(diff) === 1 ? 'unit' : 'units'}`
}
const ageText = (d: number) => (d <= 0 ? 'Opened today' : `Open for ${plural(d, 'day')}`)

export function FollowUps({ report, noun }: { report: InventorySummaryReport; noun: string }) {
  const items = [...report.followUps].sort((a, b) => b.ageDays - a.ageDays || klSortValue(a.createdAt) - klSortValue(b.createdAt))
  const historical = report.isFinal || report.snapshotKind === 'saved'
  const oldest = items[0]
  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h2 className="text-h3 font-semibold">Still open at {historical ? `${noun} end` : 'this moment'}</h2>
        <p className="text-caption text-fg-tertiary">
          {items.length === 0 ? 'No investigations outstanding.' : `${plural(items.length, 'case')}, oldest first.`}
          {oldest && oldest.ageDays >= 7 && <span className="text-warning"> Oldest has been open for {oldest.ageDays} days.</span>}
        </p>
      </div>
      {historical && items.length > 0 && (
        <p className="rounded-[10px] bg-elevated px-3 py-2 text-caption text-fg-secondary">Listed as of {formatKl(report.asOf)}. Links open each case as it stands today, which may since have been decided.</p>
      )}
      {items.length === 0 ? (
        <p className="py-6 text-center text-body-sm text-fg-tertiary">Backlog clear.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line" aria-label="Outstanding cases">
          {items.map((f) => (
            <li key={f.id}>
              <Link href={`/cases/${f.id}`} data-testid={`link-case-${f.id}`} className="group flex flex-col gap-2 rounded-[10px] px-2 py-3 hover:bg-elevated sm:flex-row sm:items-center sm:gap-4">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body-sm font-medium">{f.product}</span>
                  <span className="text-caption text-fg-tertiary"><span className="num">{f.id}</span> · {STATUS_LABEL[f.status] ?? f.status} · <span className="num">Opened {formatKl(f.createdAt)}</span></span>
                </div>
                <dl className="num grid grid-cols-3 gap-x-3 text-caption sm:flex sm:gap-4">
                  <div><dt className="inline text-fg-tertiary">Recorded: </dt><dd className="inline text-fg">{f.recorded}</dd></div>
                  <div><dt className="inline text-fg-tertiary">Counted: </dt><dd className="inline text-fg">{f.counted}</dd></div>
                  <div className="col-span-3 sm:col-span-1"><dt className="inline text-fg-tertiary">Difference: </dt>
                    <dd className="inline font-semibold" style={{ color: f.difference < 0 ? '#E98E2E' : f.difference > 0 ? '#71A5D2' : undefined }}>{differenceText(f.difference)}</dd></div>
                </dl>
                <div className="flex items-center gap-2">
                  <span className={cn('num rounded-full px-2.5 py-0.5 text-caption font-semibold whitespace-nowrap', f.ageDays >= 7 ? 'tint-warning text-warning' : 'bg-elevated text-fg-secondary')}>{ageText(f.ageDays)}</span>
                  <ArrowRight className="size-4 text-fg-tertiary transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
