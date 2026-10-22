import { useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import type { WeeklyInventoryDecisions } from '@workspace/api-client-react'
import { Card } from '@/components/veracity/primitives'

const PARTS = [
  { key: 'approved', name: 'Approved', color: '#61A9BD', help: 'Suggested outcome accepted.' },
  { key: 'overridden', name: 'Overridden', color: '#CED14E', help: 'Manager chose a different outcome than suggested.' },
  { key: 'rejected', name: 'Rejected', color: '#DD83C9', help: 'Count rejected; record kept.' },
] as const
type Key = (typeof PARTS)[number]['key']

export function DecisionPanel({ decisions: d, noun }: { decisions: WeeklyInventoryDecisions; noun: string }) {
  const [active, setActive] = useState<Key | null>(null)
  const total = d.approved + d.overridden + d.rejected
  const shown = PARTS.filter((p) => d[p.key] > 0)
  const sel = PARTS.find((p) => p.key === active)
  const pct = (v: number) => (total ? `${Math.round((v / total) * 100)}%` : '0%')
  const summary = total === 0 ? `No decisions were recorded this ${noun}.` : PARTS.map((p) => `${d[p.key]} ${p.name.toLowerCase()}`).join(', ') + ` of ${total}.`

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-h3 font-semibold">Decisions</h2>
        <p className="text-caption text-fg-tertiary">{summary}</p>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <figure className="relative mx-auto size-36 shrink-0" aria-label={`Donut chart of decision outcomes. ${summary}`} onMouseLeave={() => setActive(null)}>
          {total === 0 ? (
            <div className="size-full rounded-full border-[14px] border-elevated" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={shown.map((p) => ({ ...p, value: d[p.key] }))} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="100%" paddingAngle={shown.length > 1 ? 2 : 0} stroke="none" isAnimationActive={false}
                  onMouseEnter={(_: unknown, i: number) => setActive(shown[i]?.key ?? null)} onClick={(_: unknown, i: number) => setActive(shown[i]?.key ?? null)}>
                  {shown.map((p) => <Cell key={p.key} fill={p.color} opacity={active && active !== p.key ? 0.4 : 1} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          )}
          <figcaption className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="num text-h1 font-semibold" data-testid="text-decisions-total">{total}</span>
            <span className="text-caption text-fg-tertiary">decided</span>
          </figcaption>
        </figure>
        <ul className="flex flex-1 flex-col gap-1" aria-label="Decision breakdown">
          {PARTS.map((p) => (
            <li key={p.key}>
              <button type="button" onMouseEnter={() => setActive(p.key)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(p.key)} onBlur={() => setActive(null)}
                className="flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left text-body-sm hover:bg-elevated focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none">
                <span className="size-2.5 rounded-sm" style={{ background: p.color }} aria-hidden="true" />
                <span className="flex-1 text-fg-secondary" style={{ color: active === p.key ? p.color : undefined }}>{p.name}</span>
                <span className="num font-semibold" style={{ color: active === p.key ? p.color : undefined }} data-testid={`text-decisions-${p.key}`}>{d[p.key]}</span>
                <span className="num w-10 text-right text-caption text-fg-tertiary" style={{ color: active === p.key ? p.color : undefined }}>{total ? pct(d[p.key]) : '-'}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div aria-live="polite" data-testid="panel-decision-detail" className="min-h-[4.25rem] rounded-[14px] border border-line bg-elevated px-4 py-3 text-body-sm text-white">
        {sel ? (
          <>
            <p className="num font-semibold" style={{ color: sel.color }}>{sel.name}: {d[sel.key]} of {total} ({pct(d[sel.key])})</p>
            <p className="text-white">{sel.help}</p>
          </>
        ) : (
          <p className="text-white">Hover or focus an outcome to see its share and meaning.</p>
        )}
      </div>
    </Card>
  )
}
