import type { DecisionVersion, EvidenceState } from './types'

export const EVIDENCE_STATE_LABEL: Record<EvidenceState, string> = {
  supported: 'Supported',
  incomplete: 'Incomplete',
  conflicting: 'Conflicting',
}

/** Compare only snapshots at or before the selected assessment; never mutate them. */
export function compareAssessment(versions: readonly DecisionVersion[], viewed: DecisionVersion) {
  const previous = versions.reduce<DecisionVersion | undefined>((best, candidate) =>
    candidate.version < viewed.version && (!best || candidate.version > best.version) ? candidate : best,
  undefined)
  if (!previous) return null

  const before = new Map(previous.evidence.map(item => [item.id, item]))
  const after = new Map(viewed.evidence.map(item => [item.id, item]))
  const added = viewed.evidence.filter(item => !before.has(item.id))
  const removed = previous.evidence.filter(item => !after.has(item.id))
  const updated = viewed.evidence.filter(item => {
    const old = before.get(item.id)
    return old && (old.quantity !== item.quantity || old.type !== item.type ||
      old.stockStatus !== item.stockStatus || old.match !== item.match)
  })
  const stateChanged = previous.evidenceState !== viewed.evidenceState
  const newlyPassedRules = viewed.rules.filter(rule => rule.passed &&
    previous.rules.some(old => old.id === rule.id && !old.passed))
  const newlyFailedRules = viewed.rules.filter(rule => !rule.passed &&
    previous.rules.some(old => old.id === rule.id && old.passed))

  return { previous, added, removed, updated, stateChanged, newlyPassedRules, newlyFailedRules }
}
