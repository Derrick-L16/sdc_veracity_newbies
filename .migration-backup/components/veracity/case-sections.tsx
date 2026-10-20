import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { formatDateTime, formatSigned } from '@/lib/format'
import type { DecisionVersion, Stage, StockCase } from '@/lib/types'
import { cn } from '@/lib/utils'
import { EvidenceBadge, StatusBadge, VersionBadge } from './badges'
import { EvidenceTable, RuleResultList } from './evidence'
import { StatTile } from './primitives'

export function CaseHeader({ stockCase, backHref, backLabel }: { stockCase: StockCase; backHref: string; backLabel: string }) {
  return (
    <header className="flex flex-col gap-3">
      <Link
        href={backHref}
        className="inline-flex min-h-11 items-center gap-2 self-start text-body-sm font-medium text-fg-secondary hover:text-fg"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {backLabel}
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <span className="num text-body-sm font-medium text-fg-tertiary">{stockCase.id}</span>
        <StatusBadge status={stockCase.status} />
      </div>
      <h1 className="text-h1-sm font-semibold text-balance md:text-h1">{stockCase.product}</h1>
      <p className="text-body-sm text-fg-secondary">
        Counted by {stockCase.createdBy} · {formatDateTime(stockCase.createdAt)}
      </p>
    </header>
  )
}

export function StockSummary({ stockCase }: { stockCase: StockCase }) {
  const diff = stockCase.counted - stockCase.recorded
  return (
    <div className="grid grid-cols-3 gap-3">
      <StatTile label="Recorded" value={stockCase.recorded} />
      <StatTile label="Counted" value={stockCase.counted} />
      <StatTile label="Difference" value={formatSigned(diff)} tone="accent" />
    </div>
  )
}

export function VersionSwitcher({
  stockCase,
  active,
  basePath,
}: {
  stockCase: StockCase
  active: number
  basePath: string
}) {
  if (stockCase.versions.length < 2) return null
  const latest = stockCase.versions.length
  return (
    <nav aria-label="Recommendation versions" className="flex flex-wrap items-center gap-2">
      <span className="text-body-sm text-fg-secondary">Version</span>
      {stockCase.versions.map((v) => {
        const isActive = v.version === active
        return (
          <Link
            key={v.version}
            href={v.version === latest ? basePath : `${basePath}?v=${v.version}`}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'num flex min-h-11 items-center gap-2 rounded-full border px-4 text-body-sm font-medium',
              isActive ? 'border-accent-text bg-accent-fill/15 text-fg' : 'border-line text-fg-secondary hover:text-fg',
            )}
          >
            v{v.version}
            {v.version === latest && <span className="text-caption text-fg-tertiary">latest</span>}
          </Link>
        )
      })}
    </nav>
  )
}

export function stageContent(
  version: DecisionVersion,
  { isCurrent, rulesOpen = false }: { isCurrent: boolean; rulesOpen?: boolean },
): Partial<Record<Stage, React.ReactNode>> {
  return {
    evidence: (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <EvidenceBadge state={version.evidenceState} />
          <span className="num text-body-sm text-fg-secondary">v{version.version}</span>
          <VersionBadge current={isCurrent} />
        </div>
        <EvidenceTable items={version.evidence} caption={`Evidence for version ${version.version}`} />
      </div>
    ),
    reasoning: (
      <div className="flex flex-col gap-3">
        <p className="rounded-[12px] border border-line bg-elevated p-4 text-body">{version.conclusion}</p>
        <RuleResultList rules={version.rules} defaultOpen={rulesOpen} />
      </div>
    ),
  }
}
