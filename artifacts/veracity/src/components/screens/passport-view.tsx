
import { FileSearch } from 'lucide-react'
import { Link } from 'wouter'
import { useApp } from '@/components/app/app-provider'
import { buttonVariants } from '@/components/ui/button'
import { CaseHeader, StockSummary, stageContent } from '@/components/veracity/case-sections'
import { Card, EmptyState, LockNote, StatTile } from '@/components/veracity/primitives'
import { CaseDetailSkeleton } from '@/components/veracity/feedback'
import { Timeline } from '@/components/veracity/timeline'
import { CaseAttachments } from '@/components/veracity/case-attachments'
import { ROLE_INFO } from '@/lib/data'
import { formatDateTime } from '@/lib/format'

const ACTION_LABEL = { approved: 'Approved', rejected: 'Rejected', overridden: 'Overridden' } as const

export function PassportView({ id }: { id: string }) {
  const { getCase, loading } = useApp()
  const stockCase = getCase(id)
  const closed = stockCase && (stockCase.status === 'completed' || stockCase.status === 'rejected')

  if (loading) return <CaseDetailSkeleton />

  if (!stockCase || !closed) {
    return (
      <EmptyState
        icon={FileSearch}
        title={stockCase ? 'This case is still open' : 'Passport not found'}
        description={stockCase ? 'A Decision Passport is created once the case is decided.' : `There is no closed case with the ID ${id}.`}
        action={
          <Link href={stockCase ? `/cases/${id}` : '/history'} className={buttonVariants({ variant: 'secondary' })}>
            {stockCase ? 'Open case' : 'Back to history'}
          </Link>
        }
      />
    )
  }

  const latest = stockCase.versions[stockCase.versions.length - 1]
  const d = stockCase.decision

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <CaseHeader stockCase={stockCase} backHref="/history" backLabel="History" />
      <LockNote>This Decision Passport is read-only through the application.</LockNote>

      <Card className="flex flex-col gap-5 p-5 md:p-6">
        <h2 className="text-h3 font-semibold">Outcome</h2>
        <StockSummary stockCase={stockCase} />
        {d && (
          <dl className="grid gap-4 sm:grid-cols-2">
            <StatTile label="Final stock" value={stockCase.finalStock ?? stockCase.recorded} tone="accent" />
            <div className="flex flex-col gap-1 rounded-[12px] border border-line bg-elevated p-4">
              <dt className="text-body-sm text-fg-secondary">Decision</dt>
              <dd className="text-h3 font-semibold">{ACTION_LABEL[d.action]}</dd>
              <dd className="text-body-sm text-fg-secondary">
                {d.by} ({ROLE_INFO[d.role].label}) · {formatDateTime(d.at)}
              </dd>
            </div>
            {d.reason && (
              <div className="flex flex-col gap-1 rounded-[12px] border border-line bg-elevated p-4 sm:col-span-2">
                <dt className="text-body-sm text-fg-secondary">Reason</dt>
                <dd className="text-body">{d.reason}</dd>
              </div>
            )}
          </dl>
        )}
      </Card>

      <CaseAttachments stockCase={stockCase} viewed={latest} readOnly />
      <section aria-labelledby="passport-timeline" className="flex flex-col gap-4">
        <h2 id="passport-timeline" className="text-h3 font-semibold">
          Full record
        </h2>
        <Timeline events={stockCase.timeline} content={stageContent(latest, { isCurrent: true, rulesOpen: true })} allExpanded />
      </section>
    </div>
  )
}
