import type { CaseStatus } from './types'

export type SegmentKey = 'verified' | 'awaiting' | 'attention' | 'not_counted'

export const SEGMENT_ORDER: SegmentKey[] = ['verified', 'awaiting', 'attention', 'not_counted']

/** Case statuses that belong to each overview segment. Verified and not-counted items have no open case. */
export const SEGMENT_STATUSES: Record<SegmentKey, CaseStatus[]> = {
  verified: [],
  awaiting: ['pending_approval'],
  attention: ['needs_review', 'manual_review'],
  not_counted: [],
}

export interface MissingItem {
  name: string
  units: number
  value: number
  status: CaseStatus
  caseId: string
}

export interface StockSummary {
  total: number
  counts: Record<SegmentKey, number>
  matches: number
  items: StockSummaryItem[]
  updatedAt: string
  lastCount: string | null
  missing: {
    units: number
    value: number
    explained: number
    unexplained: number
    items: MissingItem[]
  }
  /** A count that has been started but not submitted yet. */
  inProgress?: { counted: number; total: number; by: string; startedAt: string }
}

export interface StockSummaryItem {
  productId: string
  name: string
  recorded: number
  counted: number | null
  difference: number | null
  status: 'matched' | 'difference' | 'not_counted'
  caseId: string | null
  evidenceMissing: boolean
}

export interface StaffProgress {
  counted: number
  total: number
  matched: number
  differ: number
  lastSubmitted: string | null
}

export function verifiedPercent(s: Pick<StockSummary, 'total' | 'counts'>) {
  if (s.total === 0) return 0
  return Math.round((s.counts.verified / s.total) * 100)
}

export function formatRM(n: number) {
  return `RM ${n.toFixed(2)}`
}

