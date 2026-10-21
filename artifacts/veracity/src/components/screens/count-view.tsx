
import { ChevronDown, Loader2, Send } from 'lucide-react'
import { Link } from 'wouter'
import { useLocation } from 'wouter'
import { useId, useState } from 'react'
import { toast } from 'sonner'
import { useApp } from '@/components/app/app-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { NoDifferenceBadge } from '@/components/veracity/badges'
import { Card, ErrorNotice, PageHeader, StatTile } from '@/components/veracity/primitives'
import { formatSigned } from '@/lib/format'

export function CountView() {
  const [, navigate] = useLocation()
  const { submitCount, findOpenCase, role, products: PRODUCTS } = useApp()
  const [productId, setProductId] = useState('')
  const [counted, setCounted] = useState('')
  const [diffInput, setDiffInput] = useState('')
  const [note, setNote] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const ids = {
    product: useId(),
    counted: useId(),
    diff: useId(),
    note: useId(),
    countedErr: useId(),
    productErr: useId(),
    diffErr: useId(),
  }

  const [lastEdited, setLastEdited] = useState<'counted' | 'diff' | null>(null)

  const product = PRODUCTS.find((p) => p.id === productId)
  const countedNum = counted === '' ? null : Number(counted)
  const countedValid = countedNum !== null && Number.isInteger(countedNum) && countedNum >= 0
  const diff = product && countedValid ? countedNum - product.recorded : null
  const duplicate = product && countedValid ? findOpenCase(product.name, countedNum) : undefined

  const productError = submitted && !product
  const diffNegativeError = Boolean(product && countedNum !== null && countedNum < 0)
  const diffParseError = Boolean(
    diffInput.trim() !== '' &&
      !/^[-+\u2212]?\d+$/.test(diffInput.trim()) &&
      !/^[-+\u2212]$/.test(diffInput.trim()),
  )
  const diffError = diffNegativeError || diffParseError || (submitted && Boolean(product) && !countedValid && diffInput.trim() !== '')
  const countedError = (submitted && !countedValid) || diffNegativeError

  const handleProductChange = (newProductId: string) => {
    setProductId(newProductId)
    const newProduct = PRODUCTS.find((p) => p.id === newProductId)
    if (!newProduct) return

    if (lastEdited === 'diff' && diffInput.trim() !== '') {
      const normalized = diffInput.trim().replace('\u2212', '-')
      if (/^[+-]?\d+$/.test(normalized)) {
        const parsedDiff = parseInt(normalized, 10)
        setCounted(String(newProduct.recorded + parsedDiff))
        return
      }
    }

    const currentCountedNum = counted === '' ? null : Number(counted)
    if (currentCountedNum !== null && Number.isInteger(currentCountedNum)) {
      const calculatedDiff = currentCountedNum - newProduct.recorded
      setDiffInput(calculatedDiff > 0 ? `+${calculatedDiff}` : String(calculatedDiff))
    }
  }

  const handleCountedChange = (val: string) => {
    setLastEdited('counted')
    setCounted(val)
    if (val.trim() === '') {
      setDiffInput('')
      return
    }
    const num = Number(val)
    if (!isNaN(num) && Number.isInteger(num) && product) {
      const calculatedDiff = num - product.recorded
      setDiffInput(calculatedDiff > 0 ? `+${calculatedDiff}` : String(calculatedDiff))
    }
  }

  const handleDiffChange = (val: string) => {
    setLastEdited('diff')
    setDiffInput(val)
    const trimmed = val.trim()
    if (trimmed === '' || trimmed === '+' || trimmed === '-' || trimmed === '\u2212') {
      if (trimmed === '' && product) {
        setCounted('')
      }
      return
    }
    const normalized = trimmed.replace('\u2212', '-')
    if (/^[+-]?\d+$/.test(normalized)) {
      const parsedDiff = parseInt(normalized, 10)
      if (product) {
        const calculatedCounted = product.recorded + parsedDiff
        setCounted(String(calculatedCounted))
      }
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (!product || !countedValid || duplicate || diffNegativeError) return
    setBusy(true)
    try {
      const created = await submitCount({ product: product.name, recorded: product.recorded, counted: countedNum, note: note.trim() })
      toast.success(created ? 'Count submitted. Case created.' : 'Count matches the record. Saved.')
      navigate(created ? `/cases/${created.id}` : '/inbox')
    } catch (e) { toast.error((e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader title="New count" subtitle="Enter what you counted on the shelf. Veracity compares it with the record." />

      {role === 'owner' && (
        <ErrorNotice title="Owners can't submit counts." description="Switch to Staff or Manager to try this flow." />
      )}

      <Card className="p-5 md:p-6">
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor={ids.product} className="text-body-sm font-medium">
              Product
            </Label>
            <div className="relative">
              <select
                id={ids.product}
                value={productId}
                onChange={(e) => handleProductChange(e.target.value)}
                aria-invalid={productError}
                aria-describedby={productError ? ids.productErr : undefined}
                className="h-12 w-full appearance-none rounded-[12px] border border-line bg-elevated px-4 pr-10 text-body text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent-text aria-invalid:border-danger"
              >
                <option value="">Choose a product</option>
                {PRODUCTS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-fg-secondary" aria-hidden="true" />
            </div>
            {productError && (
              <p id={ids.productErr} className="text-body-sm font-medium text-danger">
                Choose a product.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Recorded stock" value={product ? product.recorded : '—'} />
            <StatTile label="Difference" value={diff === null ? '—' : formatSigned(diff)} tone={diff ? 'accent' : 'default'} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={ids.counted} className="text-body-sm font-medium">
                Counted quantity
              </Label>
              <Input
                id={ids.counted}
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={counted}
                onChange={(e) => handleCountedChange(e.target.value)}
                aria-invalid={countedError}
                aria-describedby={countedError ? ids.countedErr : undefined}
                className="num h-14 rounded-[12px] border-line bg-elevated px-4 text-h2 font-semibold text-white"
                placeholder="0"
              />
              {countedError && (
                <p id={ids.countedErr} className="text-body-sm font-medium text-danger">
                  {countedNum !== null && countedNum < 0
                    ? 'Counted quantity cannot be less than 0.'
                    : 'Enter a whole number of 0 or more.'}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor={ids.diff} className="text-body-sm font-medium">
                Difference <span className="font-normal text-fg-tertiary">(+/-)</span>
              </Label>
              <Input
                id={ids.diff}
                type="text"
                inputMode="text"
                value={diffInput}
                onChange={(e) => handleDiffChange(e.target.value)}
                aria-invalid={diffError}
                aria-describedby={diffError ? ids.diffErr : undefined}
                className="num h-14 rounded-[12px] border-line bg-elevated px-4 text-h2 font-semibold text-white"
                placeholder="e.g. +5 or -5"
              />
              {diffError && (
                <p id={ids.diffErr} className="text-body-sm font-medium text-danger">
                  {diffNegativeError
                    ? `Difference reduces stock below 0 (${countedNum}).`
                    : diffParseError
                    ? 'Enter a valid difference like +5 or -5.'
                    : 'Difference is invalid.'}
                </p>
              )}
            </div>
          </div>

          {diff === 0 && <NoDifferenceBadge />}

          {duplicate && (
            <ErrorNotice
              title="A case for this count is already open."
              description={`${duplicate.id} has the same product and count. Open it instead of creating a duplicate.`}
              action={
                <Link href={`/cases/${duplicate.id}`} className="text-body-sm font-medium text-accent-text underline-offset-4 hover:underline">
                  Open {duplicate.id}
                </Link>
              }
            />
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor={ids.note} className="text-body-sm font-medium">
              Note <span className="font-normal text-fg-tertiary">(optional)</span>
            </Label>
            <Textarea
              id={ids.note}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Where you counted, anything unusual"
              className="min-h-24 rounded-[12px] border-line bg-elevated text-body"
            />
          </div>

          <Button type="submit" size="lg" disabled={busy || role === 'owner' || Boolean(duplicate) || diffNegativeError}>
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
            {busy ? 'Submitting…' : 'Submit count'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
