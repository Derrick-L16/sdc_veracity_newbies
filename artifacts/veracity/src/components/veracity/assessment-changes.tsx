import { useId } from 'react'
import { GitCompareArrows } from 'lucide-react'
import { compareAssessment, EVIDENCE_STATE_LABEL } from '@/lib/assessment-comparison'
import { formatSigned } from '@/lib/format'
import type { DecisionVersion } from '@/lib/types'
import { EvidenceBadge } from './badges'
import { Card } from './primitives'

export function AssessmentChanges({ versions, viewed }: {
  versions: readonly DecisionVersion[]
  viewed: DecisionVersion
}) {
  const headingId = useId()
  const change = compareAssessment(versions, viewed)

  if (!change) return (
    <Card aria-labelledby={headingId} className="flex min-w-0 flex-col gap-3 p-5 md:p-6">
      <h2 id={headingId} className="flex items-center gap-2 text-h3 font-semibold">
        <GitCompareArrows className="size-5 shrink-0 text-accent-text" aria-hidden="true" />What changed?
      </h2>
      <p className="text-body-sm text-fg-secondary">Initial assessment (v{viewed.version}). There is no earlier assessment to compare.</p>
    </Card>
  )

  const { previous, added, removed, updated, stateChanged, newlyPassedRules, newlyFailedRules } = change
  const difference = viewed.unexplained - previous.unexplained
  const coverage = difference < 0
    ? `${Math.abs(difference)} fewer unexplained units.`
    : difference > 0 ? `${difference} more unexplained units.` : 'The number of unexplained units is unchanged.'

  return (
    <Card aria-labelledby={headingId} className="flex min-w-0 flex-col gap-4 p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={headingId} className="flex items-center gap-2 text-h3 font-semibold">
          <GitCompareArrows className="size-5 shrink-0 text-accent-text" aria-hidden="true" />What changed?
        </h2>
        <span className="num text-caption font-medium text-fg-secondary">v{previous.version} → v{viewed.version}</span>
      </div>
      <p className="text-body-sm text-fg-secondary">
        {stateChanged
          ? `Evidence status changed from ${EVIDENCE_STATE_LABEL[previous.evidenceState].toLowerCase()} to ${EVIDENCE_STATE_LABEL[viewed.evidenceState].toLowerCase()}.`
          : `Evidence status remains ${EVIDENCE_STATE_LABEL[viewed.evidenceState].toLowerCase()}.`} {coverage}
      </p>
      <div className="overflow-x-auto rounded-[12px] border border-line">
        <table className="w-full text-left text-body-sm">
          <caption className="sr-only">Assessment comparison: version {previous.version} versus version {viewed.version}</caption>
          <thead className="bg-elevated text-fg-secondary">
            <tr>
              <th scope="col" className="px-3 py-3 font-medium">Comparison</th>
              <th scope="col" className="px-3 py-3 font-medium">Version {previous.version}</th>
              <th scope="col" className="px-3 py-3 font-medium">Version {viewed.version}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            <tr><th scope="row" className="px-3 py-3 font-medium">Explained units</th><td className="num px-3 py-3">{previous.explained}</td><td className="num px-3 py-3">{viewed.explained}</td></tr>
            <tr><th scope="row" className="px-3 py-3 font-medium">Unexplained units</th><td className="num px-3 py-3">{previous.unexplained}</td><td className="num px-3 py-3">{viewed.unexplained}</td></tr>
            <tr><th scope="row" className="px-3 py-3 font-medium">Evidence status</th><td className="px-3 py-3"><span className="sm:hidden">{EVIDENCE_STATE_LABEL[previous.evidenceState]}</span><span className="hidden sm:inline-flex"><EvidenceBadge state={previous.evidenceState} /></span></td><td className="px-3 py-3"><span className="sm:hidden">{EVIDENCE_STATE_LABEL[viewed.evidenceState]}</span><span className="hidden sm:inline-flex"><EvidenceBadge state={viewed.evidenceState} /></span></td></tr>
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-body-sm font-semibold">New transaction evidence</h3>
        {added.length ? <ul className="flex flex-col gap-2" aria-label="New transaction evidence">
          {added.map(item => <li key={item.id} className="break-words rounded-[12px] border border-line bg-elevated p-3 text-body-sm">
            <span className="num font-semibold text-accent-text">{item.id}</span> — {item.type} · <span className="num">{formatSigned(item.quantity)}</span> units
          </li>)}
        </ul> : <p className="text-body-sm text-fg-secondary">No transaction IDs were added in this assessment.</p>}
        {removed.length > 0 && <p className="break-words text-body-sm text-fg-secondary">No longer included: {removed.map(item => item.id).join(', ')}. Their original records remain in the earlier assessment.</p>}
        {updated.length > 0 && <p className="break-words text-body-sm text-fg-secondary">Existing records with changed assessment details: {updated.map(item => item.id).join(', ')}. Review both versions.</p>}
      </div>
      {(newlyPassedRules.length > 0 || newlyFailedRules.length > 0) && <div className="flex flex-col gap-2">
        <h3 className="text-body-sm font-semibold">Rule results that changed</h3>
        <ul className="flex flex-col gap-1 text-body-sm text-fg-secondary">
          {newlyPassedRules.map(rule => <li key={rule.id}>{rule.id} · {rule.name}: failed → passed</li>)}
          {newlyFailedRules.map(rule => <li key={rule.id}>{rule.id} · {rule.name}: passed → failed</li>)}
        </ul>
      </div>}
      <p className="rounded-[12px] border border-line bg-elevated p-3 text-caption text-fg-secondary">
        Compared from saved rule-based assessments. Numerical agreement does not prove the cause. This display changes no stock or approval permissions. Photos and PDFs require human review.
      </p>
    </Card>
  )
}
