import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { formatDate, formatSigned } from '@/lib/format'
import type { StockCase } from '@/lib/types'
import { EvidenceBadge, StatusBadge } from './badges'

export function CaseRow({ stockCase, href }: { stockCase: StockCase; href: string }) {
  const current = stockCase.versions[stockCase.versions.length - 1]
  const diff = stockCase.counted - stockCase.recorded
  const closed = stockCase.status === 'completed' || stockCase.status === 'rejected'

  return (
    <li>
      <Link
        href={href}
        className="group flex items-center gap-4 rounded-[20px] border border-line bg-surface p-4 transition-colors hover:border-fg-tertiary md:p-5"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-center md:gap-6">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="num text-caption font-medium text-fg-tertiary">{stockCase.id}</span>
              <StatusBadge status={stockCase.status} />
            </div>
            <h3 className="truncate text-h3 font-semibold">{stockCase.product}</h3>
            <p className="text-body-sm text-fg-secondary">
              {formatDate(stockCase.createdAt)} · {stockCase.createdBy}
            </p>
          </div>
          <dl className="flex items-center gap-6">
            <div className="flex flex-col">
              <dt className="text-caption text-fg-tertiary">Recorded</dt>
              <dd className="num text-h3 font-semibold">{stockCase.recorded}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-caption text-fg-tertiary">Counted</dt>
              <dd className="num text-h3 font-semibold">{stockCase.counted}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-caption text-fg-tertiary">Difference</dt>
              <dd className="num text-h3 font-semibold text-accent-text">{formatSigned(diff)}</dd>
            </div>
          </dl>
          <div className="md:w-36">
            {closed && stockCase.finalStock !== undefined ? (
              <p className="text-body-sm text-fg-secondary">
                Final stock <span className="num font-semibold text-fg">{stockCase.finalStock}</span>
              </p>
            ) : (
              <EvidenceBadge state={current.evidenceState} />
            )}
          </div>
        </div>
        <ChevronRight
          className="size-5 shrink-0 text-fg-tertiary transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </Link>
    </li>
  )
}
