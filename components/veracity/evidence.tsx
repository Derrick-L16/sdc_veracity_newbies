'use client'

import { CheckCircle2, ChevronDown, XCircle } from 'lucide-react'
import { useId, useState } from 'react'
import { formatSigned } from '@/lib/format'
import type { EvidenceItem, RuleResult } from '@/lib/types'
import { cn } from '@/lib/utils'
import { MatchBadge } from './badges'

export function EvidenceTable({ items, caption }: { items: EvidenceItem[]; caption?: string }) {
  if (items.length === 0) {
    return (
      <p className="rounded-[12px] border border-dashed border-line p-4 text-body-sm text-fg-secondary">
        No matching transactions found.
      </p>
    )
  }
  return (
    <>
      <div className="hidden overflow-hidden rounded-[12px] border border-line md:block">
        <table className="w-full text-left text-body-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="bg-elevated text-fg-secondary">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Transaction</th>
              <th scope="col" className="px-4 py-3 font-medium">Type</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Quantity</th>
              <th scope="col" className="px-4 py-3 font-medium">Stock status</th>
              <th scope="col" className="px-4 py-3 font-medium">Match</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className={cn('border-t border-line', item.isNew && 'bg-accent-fill/10')}>
                <th scope="row" className="num px-4 py-3 font-medium whitespace-nowrap">
                  {item.id}
                  {item.isNew && (
                    <span className="ml-2 rounded-full bg-accent-fill px-2 py-0.5 text-caption text-white">New</span>
                  )}
                </th>
                <td className="px-4 py-3">{item.type}</td>
                <td className="num px-4 py-3 text-right font-medium">{formatSigned(item.quantity)}</td>
                <td className="px-4 py-3 text-fg-secondary">{item.stockStatus}</td>
                <td className="px-4 py-3">
                  <MatchBadge match={item.match} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-2 md:hidden" aria-label={caption}>
        {items.map((item) => (
          <li
            key={item.id}
            className={cn(
              'flex flex-col gap-2 rounded-[12px] border border-line bg-elevated p-3',
              item.isNew && 'border-accent-text/50',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="num font-medium">
                {item.id}
                {item.isNew && (
                  <span className="ml-2 rounded-full bg-accent-fill px-2 py-0.5 text-caption text-white">New</span>
                )}
              </span>
              <span className="num text-h3 font-semibold">{formatSigned(item.quantity)}</span>
            </div>
            <span className="text-body-sm">{item.type}</span>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-body-sm text-fg-secondary">{item.stockStatus}</span>
              <MatchBadge match={item.match} />
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

export function RuleResultList({ rules, defaultOpen = false }: { rules: RuleResult[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  const passed = rules.filter((r) => r.passed).length

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 items-center justify-between gap-2 rounded-[12px] border border-line bg-elevated px-4 text-left text-body-sm font-medium hover:border-fg-tertiary"
      >
        <span>
          {open ? 'Hide rule details' : 'Show rule details'}{' '}
          <span className="num text-fg-secondary">
            ({passed} of {rules.length} passed)
          </span>
        </span>
        <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      <ul id={id} hidden={!open} className="flex flex-col gap-2">
        {rules.map((rule) => (
          <li key={rule.id} className="flex gap-3 rounded-[12px] border border-line p-3">
            {rule.passed ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
            ) : (
              <XCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
            )}
            <div className="flex flex-col gap-0.5">
              <p className="text-body-sm font-medium">
                <span className="num text-fg-secondary">{rule.id}</span> {rule.name}
                <span className={cn('ml-2', rule.passed ? 'text-success' : 'text-danger')}>
                  {rule.passed ? 'Passed' : 'Failed'}
                </span>
              </p>
              <p className="text-body-sm text-fg-secondary">{rule.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
