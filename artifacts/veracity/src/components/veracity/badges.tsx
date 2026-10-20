import { AlertCircle, AlertTriangle, CheckCircle2, Clock, Minus, XCircle, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CaseStatus, EvidenceState, MatchState } from '@/lib/types'

type Tone = 'success' | 'warning' | 'conflict' | 'danger' | 'neutral'

const TONE_CLASS: Record<Tone, string> = {
  success: 'text-success tint-success',
  warning: 'text-warning tint-warning',
  conflict: 'text-conflict tint-conflict',
  danger: 'text-danger tint-danger',
  neutral: 'text-neutral tint-neutral',
}

export function Pill({
  tone,
  icon: Icon,
  children,
  className,
}: {
  tone: Tone
  icon: LucideIcon
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-medium whitespace-nowrap',
        TONE_CLASS[tone],
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {children}
    </span>
  )
}

const STATUS: Record<CaseStatus, { label: string; tone: Tone; icon: LucideIcon }> = {
  pending_approval: { label: 'Pending approval', tone: 'warning', icon: AlertCircle },
  needs_review: { label: 'Needs review', tone: 'conflict', icon: AlertTriangle },
  manual_review: { label: 'Manual review', tone: 'danger', icon: XCircle },
  completed: { label: 'Completed', tone: 'success', icon: CheckCircle2 },
  rejected: { label: 'Rejected', tone: 'danger', icon: XCircle },
}

export const STATUS_LABEL = Object.fromEntries(Object.entries(STATUS).map(([k, v]) => [k, v.label])) as Record<
  CaseStatus,
  string
>

export function StatusBadge({ status, className }: { status: CaseStatus; className?: string }) {
  const s = STATUS[status]
  return (
    <Pill tone={s.tone} icon={s.icon} className={className}>
      {s.label}
    </Pill>
  )
}

const EVIDENCE: Record<EvidenceState, { label: string; tone: Tone; icon: LucideIcon }> = {
  supported: { label: 'Evidence supported', tone: 'success', icon: CheckCircle2 },
  incomplete: { label: 'Incomplete evidence', tone: 'warning', icon: AlertCircle },
  conflicting: { label: 'Conflicting evidence', tone: 'conflict', icon: AlertTriangle },
}

export function EvidenceBadge({ state }: { state: EvidenceState }) {
  const s = EVIDENCE[state]
  return (
    <Pill tone={s.tone} icon={s.icon}>
      {s.label}
    </Pill>
  )
}

const MATCH: Record<MatchState, { label: string; tone: Tone; icon: LucideIcon }> = {
  matched: { label: 'Matched', tone: 'success', icon: CheckCircle2 },
  unmatched: { label: 'No match', tone: 'warning', icon: AlertCircle },
  conflicting: { label: 'Conflicts', tone: 'conflict', icon: AlertTriangle },
}

export function MatchBadge({ match }: { match: MatchState }) {
  const s = MATCH[match]
  return (
    <Pill tone={s.tone} icon={s.icon}>
      {s.label}
    </Pill>
  )
}

export function VersionBadge({ current }: { current: boolean }) {
  return current ? (
    <Pill tone="success" icon={CheckCircle2}>
      Current
    </Pill>
  ) : (
    <Pill tone="neutral" icon={Clock}>
      Superseded
    </Pill>
  )
}

export function NoDifferenceBadge() {
  return (
    <Pill tone="neutral" icon={Minus}>
      No difference
    </Pill>
  )
}
