import { AlertCircle, CheckCircle2 } from 'lucide-react'
import type { DecisionVersion, StockCase } from '@/lib/types'
import { formatSigned } from '@/lib/format'
import { cn } from '@/lib/utils'

export function reconciliationExplanation(stockCase: StockCase, viewed: DecisionVersion, isCurrent: boolean) {
  // The backend supplies the complete eligible snapshot for the selected version.
  // `explained` is capped and may be zero for conflicts; never use it as net movement.
  const records = viewed.evidence
  const net = records.reduce((sum, record) => sum + record.quantity, 0)
  const expected = stockCase.recorded + net
  const remaining = stockCase.counted - expected
  const matches = remaining === 0
  const salesOnly = records.length > 0 && records.every(record => record.type.toLowerCase() === 'sale')
  const conflicting = viewed.evidenceState === 'conflicting' || records.some(record => record.match === 'conflicting')
  const supported = records.length > 0 && matches && viewed.evidenceState === 'supported' && !conflicting
  const label = salesOnly ? 'Sales records' : 'Stock movement records'
  const title = !records.length
    ? 'No eligible records explain the difference'
    : supported ? `${label} explain the difference`
    : matches ? 'Quantities match, but evidence needs review'
    : salesOnly ? 'Count and sales records don’t match' : 'Count and stock movement records don’t match'
  const calculation = `Recorded stock is ${stockCase.recorded}. ${salesOnly ? `Unposted sales of ${Math.abs(net)} units` : `Net unposted movements of ${formatSigned(net)} units`} bring expected stock to ${expected}. `
  const difference = matches
    ? `This matches your count of ${stockCase.counted}.`
    : `You counted ${stockCase.counted}—${Math.abs(remaining)} ${Math.abs(remaining) === 1 ? 'unit' : 'units'} ${remaining > 0 ? 'above' : 'below'} expected.`
  const reason = !records.length
    ? `Recorded stock is ${stockCase.recorded}; you counted ${stockCase.counted}. No eligible unposted records were found for this assessment.`
    : calculation + difference + (records.some(record => record.match === 'conflicting') ? ' Some records are flagged as conflicting.' : '')
  let next = supported
    ? 'Awaiting manager review and approval to update stock.'
    : !records.length
      ? 'Check the count and add missing records, then refresh the assessment.'
      : 'Review the count and resolve missing or conflicting records before approval.'
  if (!isCurrent) next = 'Earlier assessment. Open the current version for the latest decision.'
  else if (stockCase.status === 'completed') next = 'Decision recorded. See the outcome for the final stock.'
  else if (stockCase.status === 'rejected') next = 'Case rejected. See the recorded decision for details.'
  return { title, reason, next, supported }
}

export function ReconciliationExplanation({ stockCase, viewed, isCurrent }: {
  stockCase: StockCase
  viewed: DecisionVersion
  isCurrent: boolean
}) {
  const explanation = reconciliationExplanation(stockCase, viewed, isCurrent)
  const Icon = explanation.supported ? CheckCircle2 : AlertCircle
  return (
    <section className="flex flex-col gap-3 rounded-[12px] border border-line bg-elevated p-4" aria-label="Stock reconciliation explanation">
      <h3 className={cn('flex items-start gap-2 text-body font-semibold', explanation.supported ? 'text-success' : 'text-warning')}>
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {explanation.title}
      </h3>
      <p className="text-body-sm text-fg-secondary">{explanation.reason}</p>
      <p className="border-t border-line pt-3 text-body-sm font-medium">{explanation.next}</p>
    </section>
  )
}
