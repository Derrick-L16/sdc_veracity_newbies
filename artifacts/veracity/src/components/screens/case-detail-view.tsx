
import { FileSearch, Stamp } from 'lucide-react'
import { Link } from 'wouter'
import { useApp } from '@/components/app/app-provider'
import { buttonVariants } from '@/components/ui/button'
import { ActionPanel } from '@/components/veracity/action-panel'
import { CaseHeader, StockSummary, VersionSwitcher, stageContent } from '@/components/veracity/case-sections'
import { CaseDetailSkeleton, StaleBanner } from '@/components/veracity/feedback'
import { CoverageGauge, DiscrepancyBar } from '@/components/veracity/metrics'
import { Card, EmptyState, ErrorNotice } from '@/components/veracity/primitives'
import { Timeline } from '@/components/veracity/timeline'
import { cn } from '@/lib/utils'

export function CaseDetailView({ id, version }: { id: string; version?: number }) {
  const { getCase, loading, error, reassess, role } = useApp()
  const stockCase = getCase(id)

  if (loading) return <CaseDetailSkeleton />
  if (error) {
    return (
      <ErrorNotice
        title="Couldn't load this case."
        description={error || "Check your connection and try again."}
        action={
          <Link href={`/cases/${id}`} className="text-body-sm font-medium text-accent-text underline-offset-4 hover:underline">
            Try again
          </Link>
        }
      />
    )
  }

  if (!stockCase) {
    return (
      <EmptyState
        icon={FileSearch}
        title="Case not found"
        description={`There is no case with the ID ${id}.`}
        action={
          <Link href="/inbox" className={buttonVariants({ variant: 'secondary' })}>
            Back to inbox
          </Link>
        }
      />
    )
  }

  const latest = stockCase.versions[stockCase.versions.length - 1]
  const viewed = stockCase.versions.find((v) => v.version === version) ?? latest
  const isCurrent = viewed.version === latest.version
  const closed = stockCase.status === 'completed' || stockCase.status === 'rejected'
  const basePath = `/cases/${stockCase.id}`
  const total = Math.abs(stockCase.counted - stockCase.recorded)

  return (
    <div className="flex flex-col gap-6">
      <CaseHeader stockCase={stockCase} backHref={closed ? '/history' : '/inbox'} backLabel={closed ? 'History' : 'Inbox'} />

      {!isCurrent && <StaleBanner href={basePath} />}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,65fr)_minmax(0,35fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card className="flex flex-col gap-5 p-5 md:p-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-h3 font-semibold">Recommendation</h2>
              <p className="text-body text-fg-secondary">{viewed.summary}</p>
            </div>
            <StockSummary stockCase={stockCase} />
            <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
              <DiscrepancyBar recorded={stockCase.recorded} counted={stockCase.counted} explained={viewed.explained} />
              <CoverageGauge explained={viewed.explained} total={total} className="justify-self-center" />
            </div>
          </Card>

          <section aria-labelledby="timeline-heading" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="timeline-heading" className="text-h3 font-semibold">
                Decision timeline
              </h2>
              <VersionSwitcher stockCase={stockCase} active={viewed.version} basePath={basePath} />
            </div>
            <Timeline events={isCurrent ? stockCase.timeline : (viewed.timelineSnapshot || stockCase.timeline.filter(e => e.stage === 'trigger'))} content={stageContent(viewed, { isCurrent })} />
          </section>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6" aria-label="Decision">
          {closed ? (
            <Card className="flex flex-col gap-4 p-5">
              <h2 className="text-h3 font-semibold">Decision recorded</h2>
              {stockCase.decision && (
                <p className="text-body text-fg-secondary">
                  <span className="capitalize text-fg">{stockCase.decision.action}</span> by {stockCase.decision.by}.
                  {stockCase.decision.reason && <> Reason: {stockCase.decision.reason}</>}
                </p>
              )}
              <Link href={`/history/${stockCase.id}`} className={cn(buttonVariants({ size: 'lg' }))}>
                <Stamp aria-hidden="true" />
                Open Decision Passport
              </Link>
            </Card>
          ) : !isCurrent ? <StaleBanner href={basePath} /> : (
            <>
              {role !== 'owner' && <button className={buttonVariants({ variant: 'secondary' })} onClick={() => { void reassess(id).catch(e => window.alert(e.message)) }}>Refresh evidence & reassess</button>}
              <ActionPanel key={latest.version} stockCase={stockCase} />
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
