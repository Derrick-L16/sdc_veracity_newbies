import './_group.css'
import { AlertTriangle, ArrowRight, ArrowUpRight, Check } from 'lucide-react'

type Product = { id: string; name: string; counted: number | null; recorded: number }
const products: Product[] = [
  { id: 'milk', name: 'Fresh milk, full cream 1L', counted: 43, recorded: 50 },
  { id: 'beans', name: 'House coffee beans 500g', counted: 53, recorded: 50 },
  { id: 'rice', name: 'Jasmine rice 5kg', counted: 50, recorded: 50 },
  { id: 'paper', name: 'Kitchen paper roll', counted: null, recorded: 24 },
  { id: 'tea', name: 'Breakfast tea bags 100ct', counted: 31, recorded: 35 },
  { id: 'sugar', name: 'Cane sugar 2kg', counted: 28, recorded: 28 },
]

export function Current() {
  return (
    <main className="min-h-screen bg-base p-4 font-sans text-fg">
      <section className="mx-auto flex max-w-[520px] flex-col gap-4 rounded-[20px] border border-line bg-surface p-5">
        <div>
          <h2 className="text-h3 font-semibold">Stock summary</h2>
          <p className="text-body-sm text-fg-secondary">Counted vs recorded</p>
        </div>
        <p className="text-h2 font-semibold tabular-nums">9 of 37 match</p>
        <ul className="flex flex-col divide-y divide-line">
          {products.map((product) => {
            const diff = product.counted === null ? null : product.counted - product.recorded
            const progress = product.counted === null ? 0 : Math.min(100, Math.round(product.counted / Math.max(product.recorded, 1) * 100))
            return (
              <li key={product.id}>
                <a href="#" className={`flex min-h-11 flex-col gap-1.5 rounded-[10px] px-2 py-3 hover:bg-elevated ${product.id === 'milk' ? 'bg-accent-fill/10 ring-1 ring-accent-text' : ''}`}>
                  <span className="flex min-w-0 items-center justify-between gap-2">
                    <span className="truncate text-body-sm font-medium">{product.name}</span>
                  </span>
                  <span className="text-caption text-fg-secondary tabular-nums">{product.counted === null ? 'Not counted' : `${product.counted} counted · ${product.recorded} recorded`}</span>
                  <span className="h-1.5 w-full overflow-hidden rounded-full bg-elevated" role="progressbar" aria-label={`${product.name} counted stock`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                    <span className="block h-full rounded-full bg-accent-fill" style={{ width: `${progress}%` }} />
                  </span>
                  {diff === null
                    ? <span className="inline-flex items-center gap-1.5 text-caption text-fg-tertiary"><AlertTriangle className="size-3.5" aria-hidden="true" />Not counted</span>
                    : diff === 0
                      ? <span className="inline-flex items-center gap-1.5 text-caption text-success"><Check className="size-3.5" aria-hidden="true" />Matches</span>
                      : diff < 0
                        ? <span className="inline-flex items-center gap-1.5 text-caption text-danger"><AlertTriangle className="size-3.5" aria-hidden="true" />Short by {Math.abs(diff)}</span>
                        : <span className="inline-flex items-center gap-1.5 text-caption text-accent-text"><ArrowUpRight className="size-3.5 text-fg-secondary" aria-hidden="true" />More by {diff}</span>}
                </a>
              </li>
            )
          })}
        </ul>
        <p className="text-caption text-fg-tertiary">Last updated 22 Oct, 08:45</p>
        <a href="#" className="self-start text-body-sm font-medium text-accent-text">View full summary <ArrowRight className="inline size-4" aria-hidden="true" /></a>
      </section>
    </main>
  )
}
