import './_group.css'
import { ArrowDown, ArrowRight, ArrowUp, Check, ChevronRight, Minus } from 'lucide-react'

type Product = { id: string; name: string; counted: number | null; recorded: number }
const products: Product[] = [
  { id: 'milk', name: 'Fresh milk, full cream 1L', counted: 43, recorded: 50 },
  { id: 'tea', name: 'Breakfast tea bags 100ct', counted: 31, recorded: 35 },
  { id: 'beans', name: 'House coffee beans 500g', counted: 53, recorded: 50 },
  { id: 'oil', name: 'Extra virgin olive oil 750ml', counted: 18, recorded: 20 },
  { id: 'paper', name: 'Kitchen paper roll', counted: null, recorded: 24 },
  { id: 'rice', name: 'Jasmine rice 5kg', counted: 50, recorded: 50 },
]

function Status({ product }: { product: Product }) {
  if (product.counted === null) return <span className="inline-flex flex-col items-end text-right text-[14px] font-semibold leading-5 text-fg-tertiary"><span className="inline-flex items-center gap-1.5"><Minus className="size-4" aria-hidden="true" />Not counted</span></span>
  const difference = product.counted - product.recorded
  if (!difference) return <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold leading-5 text-success"><Check className="size-4" aria-hidden="true" />Match</span>
  const percent = product.recorded === 0 ? 0 : Math.round(difference / product.recorded * 100)
  const label = `${difference < 0 ? '−' : '+'}${Math.abs(percent)}%`
  return (
    <span className={`flex flex-col items-end text-right text-[14px] font-semibold leading-5 ${difference < 0 ? 'text-danger' : 'text-accent-text'}`}>
      <span className="inline-flex items-center gap-1.5">{difference < 0 ? <ArrowDown className="size-4" aria-hidden="true" /> : <ArrowUp className="size-4 text-fg-secondary" aria-hidden="true" />}{label}</span>
      <span className="text-[11px] font-normal leading-4 text-fg-secondary tabular-nums">{difference < 0 ? '−' : '+'}{Math.abs(difference)} units</span>
    </span>
  )
}

function Row({ product, selected }: { product: Product; selected: boolean }) {
  const count = product.counted ?? 0
  const progress = product.counted === null ? 0 : Math.min(100, Math.round(count / Math.max(product.recorded, 1) * 100))
  const overflow = product.counted !== null && product.counted > product.recorded
  return (
    <li>
      <a href="#" title={product.name} aria-label={`${product.name}; ${product.counted === null ? 'not counted' : `${product.counted} counted of ${product.recorded} recorded`}; open in Summary`}
        className={`group grid min-h-[60px] grid-cols-[36px_minmax(0,1fr)_auto_16px] grid-rows-[22px_20px] items-center gap-x-3 gap-y-1 rounded-[10px] border-l-2 px-2 py-1.5 transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-accent-text ${selected ? 'border-l-accent-fill bg-elevated' : 'border-l-transparent'}`}>
        <span aria-hidden="true" className="row-span-2 flex size-9 items-center justify-center rounded-full bg-elevated text-body-sm font-semibold text-fg-secondary">{product.name.trim().charAt(0).toUpperCase()}</span>
        <span className="min-w-0 truncate text-[15px] font-medium leading-5" title={product.name}>{product.name}</span>
        <span className="col-start-3 row-start-1 flex items-center"><Status product={product} /></span>
        <ChevronRight className="row-span-2 col-start-4 row-start-1 size-4 text-fg-tertiary" aria-hidden="true" />
        <span className="col-start-2 col-span-2 row-start-2 flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-[13px] leading-5 text-fg-secondary tabular-nums">{product.counted === null ? `— / ${product.recorded}` : `${product.counted} / ${product.recorded}`}</span>
          <span className="relative h-1 w-full min-w-8 overflow-visible rounded-full bg-elevated" role="progressbar" aria-label={`${product.name} counted stock`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
            <span className="block h-full rounded-full bg-accent-fill" style={{ width: `${progress}%` }} />
            {overflow && <span aria-hidden="true" className="absolute right-0 top-1/2 h-2 w-px -translate-y-1/2 bg-accent-text" />}
          </span>
        </span>
      </a>
    </li>
  )
}

export function CountProgress() {
  const visible = products.slice(0, 6)
  return (
    <main className="min-h-screen bg-base p-4 font-sans text-fg">
      <section className="mx-auto flex max-h-[calc(100vh-32px)] max-w-[520px] flex-col rounded-[20px] border border-line bg-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-h3 font-semibold">Count progress</h2>
            <p className="text-body-sm text-fg-secondary">Counted vs recorded</p>
          </div>
          <p className="text-caption text-fg-tertiary"><span className="block">Last updated</span><time>22 Oct, 08:45</time></p>
        </div>
        <div className="mt-4 flex items-baseline justify-between gap-3">
          <p className="text-h2 font-semibold tabular-nums">9 of 37 match</p>
          <p className="text-caption text-fg-secondary">4 differ</p>
        </div>
        <ul className="mt-3 flex max-h-[min(60vh,480px)] flex-col gap-4 overflow-y-auto pr-1" aria-label="Count progress by product">
          {visible.map((product, index) => <Row key={product.id} product={product} selected={index === 0} />)}
        </ul>
        <a href="#" className="mt-4 min-h-11 self-start text-body-sm font-medium text-accent-text underline-offset-4 hover:underline">View all 37 products <ArrowRight className="inline size-4" aria-hidden="true" /></a>
      </section>
    </main>
  )
}
