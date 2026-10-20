'use client'

import { ChevronDown, ClipboardCheck, FileSearch, Flag, Scale, UserCheck, type LucideIcon } from 'lucide-react'
import { useId, useState } from 'react'
import { formatDateTime } from '@/lib/format'
import type { Stage, TimelineEvent } from '@/lib/types'
import { cn } from '@/lib/utils'

const STAGE_META: Record<Stage, { title: string; icon: LucideIcon }> = {
  trigger: { title: 'Trigger', icon: Flag },
  evidence: { title: 'Evidence', icon: FileSearch },
  reasoning: { title: 'Reasoning', icon: Scale },
  approval: { title: 'Approval', icon: UserCheck },
  outcome: { title: 'Outcome', icon: ClipboardCheck },
}

export function Timeline({
  events,
  content,
  defaultExpanded = ['evidence'],
  allExpanded = false,
}: {
  events: TimelineEvent[]
  content: Partial<Record<Stage, React.ReactNode>>
  defaultExpanded?: Stage[]
  allExpanded?: boolean
}) {
  return (
    <ol className="flex flex-col" aria-label="Case timeline">
      {events.map((event, i) => (
        <TimelineItem
          key={`${event.stage}-${i}`}
          event={event}
          last={i === events.length - 1}
          defaultOpen={allExpanded || defaultExpanded.includes(event.stage)}
          lockOpen={allExpanded}
        >
          {events.findLastIndex(e => e.stage === event.stage) === i ? content[event.stage] : null}
        </TimelineItem>
      ))}
    </ol>
  )
}

function TimelineItem({
  event,
  last,
  defaultOpen,
  lockOpen,
  children,
}: {
  event: TimelineEvent
  last: boolean
  defaultOpen: boolean
  lockOpen: boolean
  children?: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  const meta = STAGE_META[event.stage]
  const pending = !event.at
  const Icon = meta.icon

  return (
    <li className="relative flex gap-3 pb-4 md:gap-4">
      <div className="flex flex-col items-center">
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-full border',
            pending ? 'border-dashed border-line text-fg-tertiary' : 'border-line bg-elevated text-accent-text',
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
        {!last && <span className="mt-2 w-px flex-1 bg-line" aria-hidden="true" />}
      </div>
      <div className="min-w-0 flex-1 rounded-[20px] border border-line bg-surface p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h3 className="text-h3 font-semibold">{meta.title}</h3>
            <p className={cn('text-body', pending ? 'text-fg-secondary' : 'text-fg')}>{event.summary}</p>
            <p className="text-caption font-medium text-fg-tertiary">
              {pending ? 'Not reached yet' : `${formatDateTime(event.at)} · ${event.actor}`}
            </p>
          </div>
          {children && !lockOpen && (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={id}
              onClick={() => setOpen((v) => !v)}
              className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-elevated text-fg-secondary hover:text-fg"
            >
              <span className="sr-only">
                {open ? 'Collapse' : 'Expand'} {meta.title}
              </span>
              <ChevronDown className={cn('size-5 transition-transform', open && 'rotate-180')} aria-hidden="true" />
            </button>
          )}
        </div>
        {children && (
          <div id={id} hidden={!open} className="mt-4">
            {children}
          </div>
        )}
      </div>
    </li>
  )
}
