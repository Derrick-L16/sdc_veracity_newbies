'use client'

import { ChevronDown, Loader2, Send } from 'lucide-react'
import { Link, useLocation } from 'wouter'
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
  const [note, setNote] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const ids = { product: useId(), counted: useId(), note: useId(), countedErr: useId(), productErr: useId() }

  const product = PRODUCTS.find((p) => p.id === productId)
  const countedNum = counted === '' ? null : Number(counted)
  const countedValid = countedNum !== null && Number.isInteger(countedNum) && countedNum >= 0
  const diff = product && countedValid ? countedNum - product.recorded : null
  const duplicate = product && countedValid ? findOpenCase(product.name, countedNum) : undefined

  const productError = submitted && !product
  const countedError = submitted && !countedValid

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (!product || !countedValid || duplicate) return
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
                onChange={(e) => setProductId(e.target.value)}
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
              onChange={(e) => setCounted(e.target.value)}
              aria-invalid={countedError}
              aria-describedby={countedError ? ids.countedErr : undefined}
              className="num h-14 rounded-[12px] border-line bg-elevated px-4 text-h2 font-semibold text-[#dedede]"
              placeholder="0"
            />
            {countedError && (
              <p id={ids.countedErr} className="text-body-sm font-medium text-danger">
                Enter a whole number of 0 or more.
              </p>
            )}
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

          <Button type="submit" size="lg" disabled={busy || role === 'owner' || Boolean(duplicate)}>
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
            {busy ? 'Submitting…' : 'Submit count'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
