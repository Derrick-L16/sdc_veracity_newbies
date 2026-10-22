import { CheckCircle2, ClipboardList, Clock, Eye, FileSearch, Lock, Search } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'wouter'
import { useApp } from '@/components/app/app-provider'
import { buttonVariants } from '@/components/ui/button'
import { StatusBadge } from '@/components/veracity/badges'
import { Block } from '@/components/veracity/feedback'
import { Card, EmptyState, ErrorNotice, PageHeader } from '@/components/veracity/primitives'
import { CLOSED_STATUSES, OPEN_STATUSES } from '@/lib/data'
import { formatSigned } from '@/lib/format'
import { formatKl, klSortValue } from '@/lib/kl-time'
import type { StockCase } from '@/lib/types'
import { cn } from '@/lib/utils'

const ACTION_LABEL = { approved: 'Approved', rejected: 'Rejected', overridden: 'Overridden' } as const

export function StaffWorkView() {
  const { role, user, cases, progress, loading, error, refresh } = useApp()

  const mine = useMemo(() => (role === 'staff' ? cases.filter((c) => c.createdBy === user.name) : []), [cases, role, user.name])
  const waiting = mine.filter((c) => c.status === 'pending_approval').sort((a, b) => klSortValue(b.createdAt) - klSortValue(a.createdAt))
  const review = mine.filter((c) => OPEN_STATUSES.includes(c.status) && c.status !== 'pending_approval').sort((a, b) => klSortValue(b.createdAt) - klSortValue(a.createdAt))
  const closed = mine
    .filter((c) => CLOSED_STATUSES.includes(c.status))
    .sort((a, b) => klSortValue(b.decision?.at ?? b.createdAt) - klSortValue(a.decision?.at ?? a.createdAt))

  if (loading) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading your work">
        <Block className="h-10 w-56" />
        <Block className="h-36 w-full" />
        <Block className="h-24 w-full" />
        <Block className="h-24 w-full" />
      </div>
    )
  }
  if (role !== 'staff') {
    return (
      <div className="mx-auto max-w-xl" data-testid="panel-work-access">
        <EmptyState
          icon={Lock}
          title="My work is the staff home"
          description="This page shows a staff member's own counts and submitted cases. Your role has its own home."
          action={<Link href="/" className={buttonVariants({ variant: 'secondary' })} data-testid="link-access-home">Go to your home</Link>}
        />
      </div>
    )
  }

  const pct = progress.total > 0 ? Math.round((progress.counted / progress.total) * 1000) / 10 : 0
  const remaining = Math.max(progress.total - progress.counted, 0)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="My work" subtitle={`Hi ${user.name}. Your counts and the cases you submitted.`}>
        <Link href="/count" className={cn(buttonVariants({ size: 'lg' }), 'self-start md:self-auto')} data-testid="link-start-count">
          <ClipboardList aria-hidden="true" /> Start a count
        </Link>
      </PageHeader>

      {error && <ErrorNotice title="Could not refresh your work" description={`${error} Showing the last loaded data.`} onRetry={() => void refresh().catch(() => {})} />}

      <Card className="flex flex-col gap-4 p-5 md:p-6" aria-labelledby="progress-title" data-testid="card-progress">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="progress-title" className="text-h3 font-semibold">Current count coverage</h2>
            <p className="text-body-sm text-fg-secondary">Based on each product's latest count, not a weekly target.</p>
          </div>
          <p className="num text-h1 font-semibold">
            {progress.counted}<span className="text-h3 text-fg-tertiary"> / {progress.total}</span>
          </p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-elevated" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.counted} aria-label="Products with a current count">
          <div className="h-full origin-left rounded-full bg-accent-fill transition-transform duration-500" style={{ transform: `scaleX(${pct / 100})` }} />
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Verified', progress.matched, 'Matched or approved'],
            ['Needs attention', progress.differ, 'Outstanding differences'],
            ['Not counted yet', remaining, `${pct}% covered`],
            ['Last submitted', progress.lastSubmitted ? formatKl(progress.lastSubmitted) : 'None yet', ''],
          ].map(([label, value, hint]) => (
            <div key={label} className="flex flex-col gap-0.5 rounded-[12px] border border-line bg-elevated p-3">
              <dt className="text-caption text-fg-tertiary">{label}</dt>
              <dd className={cn('num font-semibold', typeof value === 'number' ? 'text-h2' : 'text-body-sm')}>{value}</dd>
              {hint && <dd className="text-caption text-fg-secondary">{hint}</dd>}
            </div>
          ))}
        </dl>
      </Card>

      <Section
        title="Waiting for a manager"
        hint="Submitted and waiting for a manager's decision. Nothing for you to do."
        icon={Clock}
        items={waiting}
        empty="None of your cases are waiting for approval."
        href={(c) => `/cases/${c.id}`}
        id="waiting"
      />
      <Section
        title="Under review"
        hint="These cases need more checking before a decision. Open one to see what the evidence shows."
        icon={Search}
        items={review}
        empty="None of your cases are under review."
        href={(c) => `/cases/${c.id}`}
        id="review"
      />

      {mine.length === 0 && progress.matched > 0 && (
        <p className="text-body-sm text-fg-secondary">
          Counts that matched the record do not open a case, so they are only reflected in your coverage above.
        </p>
      )}

      <section className="flex flex-col gap-3" aria-labelledby="closed-title">
        <h2 id="closed-title" className="flex items-center gap-2 text-h3 font-semibold">
          <CheckCircle2 className="size-4 text-fg-tertiary" aria-hidden="true" /> Previous outcomes
        </h2>
        {closed.length === 0 ? (
          <EmptyState icon={FileSearch} title="No decided cases yet" description="When a manager decides one of your cases, the outcome and its Decision Passport appear here." />
        ) : (
          <ul className="flex flex-col gap-2">
            {closed.map((c) => (
              <li key={c.id}>
                <Link href={`/history/${c.id}`} className="flex flex-wrap items-center gap-3 rounded-[12px] border border-line bg-surface p-4 transition-colors hover:border-fg-tertiary" data-testid={`link-outcome-${c.id}`}>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">{c.product}</span>
                    <span className="num text-caption text-fg-tertiary">{c.id}{c.decision ? ` · ${formatKl(c.decision.at)}` : ''}</span>
                  </span>
                  <span className="text-body-sm font-medium">{c.decision ? ACTION_LABEL[c.decision.action] : 'Closed'}</span>
                  <Eye className="size-4 text-fg-tertiary" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Section({ title, hint, icon: Icon, items, empty, href, id }: {
  title: string; hint: string; icon: typeof Clock; items: StockCase[]; empty: string; href: (c: StockCase) => string; id: string
}) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby={`${id}-title`}>
      <div>
        <h2 id={`${id}-title`} className="flex items-center gap-2 text-h3 font-semibold">
          <Icon className="size-4 text-fg-tertiary" aria-hidden="true" /> {title}
          <span className="num text-body-sm font-normal text-fg-tertiary">{items.length}</span>
        </h2>
        <p className="text-body-sm text-fg-secondary">{hint}</p>
      </div>
      {items.length === 0 ? (
        <p className="rounded-[12px] border border-dashed border-line px-4 py-3 text-body-sm text-fg-tertiary">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((c) => (
            <li key={c.id}>
              <Link href={href(c)} className="flex flex-wrap items-center gap-3 rounded-[12px] border border-line bg-surface p-4 transition-colors hover:border-fg-tertiary" data-testid={`link-case-${c.id}`}>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{c.product}</span>
                  <span className="num text-caption text-fg-tertiary">{c.id} · submitted {formatKl(c.createdAt)}</span>
                </span>
                <span className="num text-body-sm text-fg-secondary">{c.recorded} recorded, {c.counted} counted ({formatSigned(c.counted - c.recorded)})</span>
                <StatusBadge status={c.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
