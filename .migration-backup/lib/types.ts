export type Role = 'staff' | 'manager' | 'owner'

export type CaseStatus =
  | 'pending_approval'
  | 'needs_review'
  | 'manual_review'
  | 'completed'
  | 'rejected'

export type EvidenceState = 'supported' | 'incomplete' | 'conflicting'

export type Stage = 'trigger' | 'evidence' | 'reasoning' | 'approval' | 'outcome'

export type MatchState = 'matched' | 'unmatched' | 'conflicting'

export interface User {
  id: string
  name: string
  role: Role
}

export interface EvidenceItem {
  id: string
  type: string
  quantity: number
  stockStatus: string
  match: MatchState
  isNew?: boolean
}

export interface RuleResult {
  id: string
  name: string
  passed: boolean
  detail: string
}

export interface DecisionVersion {
  version: number
  createdAt: string
  evidenceState: EvidenceState
  explained: number
  unexplained: number
  summary: string
  conclusion: string
  evidence: EvidenceItem[]
  rules: RuleResult[]
  timelineSnapshot?: TimelineEvent[]
  impact: string[]
}

export interface TimelineEvent {
  stage: Stage
  summary: string
  at: string
  actor: string
}

export interface Decision {
  action: 'approved' | 'rejected' | 'overridden'
  by: string
  role: Role
  reason: string
  at: string
}

export interface StockCase {
  id: string
  product: string
  recorded: number
  counted: number
  status: CaseStatus
  createdAt: string
  createdBy: string
  versions: DecisionVersion[]
  timeline: TimelineEvent[]
  decision?: Decision
  finalStock?: number
}

export interface Product {
  id: string
  name: string
  recorded: number
}
