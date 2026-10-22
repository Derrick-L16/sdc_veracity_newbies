import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { AlertCircle, ArrowDown, ArrowRight, ArrowUp, CheckCircle2, ChevronDown, FileText, Loader2, Lock, Paperclip, Plus, Send, X } from 'lucide-react'
import { Link, useLocation } from 'wouter'
import { toast } from 'sonner'
import { useApp } from '@/components/app/app-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { NoDifferenceBadge, Pill } from '@/components/veracity/badges'
import { Card, EmptyState, ErrorNotice, PageHeader } from '@/components/veracity/primitives'
import { CaseAttachments } from '@/components/veracity/case-attachments'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime, formatSigned } from '@/lib/format'
import type { Product, StockCase } from '@/lib/types'
import type { StockSummaryItem } from '@/lib/stock'

type ViewMode = 'count' | 'product' | 'evidence' | 'complete'
type FileChoice = { file: File; description: string }

export function CountView() {
  const [, navigate] = useLocation()
  const { submitCount, findOpenCase, createProduct, role, products, summary, loading, error, refresh } = useApp()
  const [mode, setMode] = useState<ViewMode>('count')
  const [productId, setProductId] = useState('')
  const [counted, setCounted] = useState('')
  const [note, setNote] = useState('')
  const [productName, setProductName] = useState('')
  const [openingQty, setOpeningQty] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [productNote, setProductNote] = useState('')
  const [productErrors, setProductErrors] = useState<{ name?: string; recorded?: string; unitCost?: string }>({})
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [openedCase, setOpenedCase] = useState<StockCase | null>(null)
  const [createdProduct, setCreatedProduct] = useState<Product | null>(null)
  const [productEvidence, setProductEvidence] = useState<FileChoice | null>(null)
  const [completion, setCompletion] = useState<'matched' | 'case' | 'product' | 'product-later'>('matched')
  const [countMessage, setCountMessage] = useState('')
  const [productFormError, setProductFormError] = useState('')
  const ids = {
    product: useId(), counted: useId(), note: useId(), countedErr: useId(), productErr: useId(),
    name: useId(), nameErr: useId(), opening: useId(), openingErr: useId(), cost: useId(), costErr: useId(),
    productNote: useId(), evidenceFile: useId(),
  }
  const addTrigger = useRef<HTMLButtonElement>(null)
  const viewHeading = useRef<HTMLHeadingElement>(null)
  const previousMode = useRef(mode)
  const product = products.find((p) => p.id === productId)
  const countedNum = counted === '' ? null : Number(counted)
  const countedValid = countedNum !== null && Number.isInteger(countedNum) && countedNum >= 0
  const difference = product && countedValid ? countedNum - product.recorded : null
  const duplicate = product && countedValid ? findOpenCase(product.name, countedNum) : undefined
  const owner = role === 'owner'

  useEffect(() => {
    if (previousMode.current === mode) return
    if (mode === 'count') addTrigger.current?.focus()
    else viewHeading.current?.focus()
    previousMode.current = mode
  }, [mode])

  const confirmDiscard = (message: string) => typeof window === 'undefined' || window.confirm(message)
  const leaveProductForm = () => {
    const dirty = Boolean(productName.trim() || openingQty.trim() || unitCost.trim() || productNote.trim())
    if (dirty && !confirmDiscard('Discard changes? The product details you entered will be lost.')) return
    setProductName(''); setOpeningQty(''); setUnitCost(''); setProductNote(''); setProductErrors({}); setProductFormError('')
    setMode('count')
  }
  const leaveProductEvidence = () => {
    if (productEvidence && !confirmDiscard('Discard the selected file? The product will stay saved with evidence missing.')) return
    setProductEvidence(null)
    setMode('complete')
    setCompletion('product-later')
  }
  const handleProductChange = (nextId: string) => {
    setProductId(nextId)
    setCounted('')
    setSubmitted(false)
  }

  const submitCountForm = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (!product || !countedValid || duplicate || difference === null || difference < -product.recorded || owner) return
    setBusy(true)
    try {
      const created = await submitCount({ product: product.name, recorded: product.recorded, counted: countedNum, note: note.trim() })
      if (created) {
        setOpenedCase(created)
        setCompletion('case')
        setCountMessage('')
        setMode('evidence')
        toast.success('Count submitted. Case created.')
      } else {
        setCompletion('matched')
        setCountMessage(`${product.name} matched the record. No evidence is needed.`)
        setMode('complete')
        toast.success('Count matches the record. Saved.')
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally { setBusy(false) }
  }

  const submitProduct = async (event: FormEvent) => {
    event.preventDefault()
    if (owner || busy) return
    const errors: typeof productErrors = {}
    const name = productName.trim()
    const recorded = openingQty === '' ? NaN : Number(openingQty)
    const cost = unitCost.trim() === '' ? undefined : Number(unitCost)
    if (!name) errors.name = 'Enter a product name.'
    else if (products.some((p) => p.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) errors.name = 'A product with this name already exists. Count it instead.'
    if (!Number.isInteger(recorded) || recorded < 0 || recorded > 1_000_000_000) errors.recorded = 'Enter a whole number of 0 or more.'
    if (cost !== undefined && (!Number.isFinite(cost) || cost < 0 || cost > 1_000_000_000)) errors.unitCost = 'Enter a valid cost of 0 or more.'
    setProductErrors(errors)
    if (Object.keys(errors).length) return
    setBusy(true)
    setProductFormError('')
    try {
      const saved = await createProduct({ name, recorded, ...(cost === undefined ? {} : { unit_cost: cost }), ...(productNote.trim() ? { note: productNote.trim() } : {}) })
      setCreatedProduct(saved)
      setMode('evidence')
      setCompletion('product')
      toast.success('Product added.')
    } catch (e) {
      setProductFormError((e as Error).message || 'Could not add this product. Try again.')
    } finally { setBusy(false) }
  }

  const beginAnother = () => {
    setProductId(''); setCounted(''); setNote(''); setProductName(''); setOpeningQty(''); setUnitCost(''); setProductNote('')
    setOpenedCase(null); setCreatedProduct(null); setProductEvidence(null); setSubmitted(false); setMode('count')
  }

  return (
    <div className="flex flex-col gap-6" data-testid="page-count">
      <PageHeader title="New count" subtitle="Enter what you counted on the shelf. Veracity compares it with the record.">
        {!owner && mode === 'count' && (
          <Button ref={addTrigger} type="button" variant="outline" onClick={() => setMode('product')} data-testid="button-add-new-product">
            <Plus aria-hidden="true" /> Add New Product
          </Button>
        )}
      </PageHeader>
      {owner && <ErrorNotice title="Owners can't submit counts or add products." description="Switch to Staff or Manager to make inventory changes. Owners have read-only visibility." />}

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="min-w-0">
          {mode === 'count' && (
            <Card className="p-5 md:p-6">
              <h2 ref={viewHeading} tabIndex={-1} className="mb-5 text-h3 font-semibold outline-none">New count</h2>
              <form onSubmit={submitCountForm} noValidate className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <Label htmlFor={ids.product} className="text-body-sm font-medium">Product</Label>
                  <div className="relative">
                    <select id={ids.product} value={productId} onChange={(e) => handleProductChange(e.target.value)} aria-invalid={submitted && !product}
                      aria-describedby={submitted && !product ? ids.productErr : undefined} disabled={owner}
                      className="h-12 w-full appearance-none rounded-[12px] border border-line bg-elevated px-4 pr-10 text-body text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent-text aria-invalid:border-danger">
                      <option value="">Choose a product</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-fg-secondary" aria-hidden="true" />
                  </div>
                  {submitted && !product && <p id={ids.productErr} className="text-body-sm font-medium text-danger">Choose a product.</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1 rounded-[12px] border border-line bg-elevated p-4"><span className="text-body-sm text-fg-secondary">Recorded stock</span><span className="num text-h2 font-semibold">{product ? product.recorded : '—'}</span></div>
                  <div className="flex flex-col gap-1 rounded-[12px] border border-line bg-elevated p-4"><span className="text-body-sm text-fg-secondary">Difference</span><span className="num text-h2 font-semibold">{difference === null ? '—' : formatSigned(difference)}</span></div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor={ids.counted} className="text-body-sm font-medium">Counted quantity</Label>
                  <Input id={ids.counted} type="number" inputMode="numeric" min={0} step={1} value={counted} onChange={(e) => setCounted(e.target.value)}
                    aria-invalid={submitted && !countedValid} aria-describedby={submitted && !countedValid ? ids.countedErr : undefined}
                    disabled={owner} className="num h-14 rounded-[12px] border-line bg-elevated px-4 text-h2 font-semibold" placeholder="0" />
                  {submitted && !countedValid && <p id={ids.countedErr} className="text-body-sm font-medium text-danger">Enter a whole number of 0 or more.</p>}
                </div>
                {difference === 0 && <NoDifferenceBadge />}
                {duplicate && <ErrorNotice title="A case for this count is already open." description={`${duplicate.id} has the same product and count. Open it instead of creating a duplicate.`}
                  action={<Link href={`/cases/${duplicate.id}`} className="text-body-sm font-medium text-accent-text underline-offset-4 hover:underline">Open {duplicate.id}</Link>} />}
                <div className="flex flex-col gap-2">
                  <Label htmlFor={ids.note} className="text-body-sm font-medium">Note <span className="font-normal text-fg-tertiary">(optional)</span></Label>
                  <Textarea id={ids.note} value={note} onChange={(e) => setNote(e.target.value)} rows={3} disabled={owner}
                    placeholder="Where you counted, anything unusual" className="min-h-24 rounded-[12px] border-line bg-elevated text-body" />
                </div>
                <Button type="submit" size="lg" disabled={busy || owner || Boolean(duplicate)}>
                  {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
                  {busy ? 'Submitting…' : 'Submit count'}
                </Button>
              </form>
            </Card>
          )}

          {mode === 'product' && (
            <Card className="p-5 md:p-6">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div><p className="mb-1 text-caption text-fg-tertiary">Step 1 of 2</p><h2 ref={viewHeading} tabIndex={-1} className="text-h3 font-semibold outline-none">Add new product</h2></div>
              </div>
              <form onSubmit={submitProduct} noValidate className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <Label htmlFor={ids.name} className="text-body-sm font-medium">Product name</Label>
                  <Input id={ids.name} value={productName} onChange={(e) => { setProductName(e.target.value); setProductErrors((v) => ({ ...v, name: undefined })) }}
                    aria-invalid={Boolean(productErrors.name)} aria-describedby={productErrors.name ? ids.nameErr : undefined} disabled={busy} maxLength={4000} />
                  {productErrors.name && <p id={ids.nameErr} className="text-body-sm font-medium text-danger">{productErrors.name}</p>}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor={ids.opening} className="text-body-sm font-medium">Recorded (opening) quantity</Label>
                  <Input id={ids.opening} type="number" inputMode="numeric" min={0} step={1} value={openingQty} onChange={(e) => { setOpeningQty(e.target.value); setProductErrors((v) => ({ ...v, recorded: undefined })) }}
                    aria-invalid={Boolean(productErrors.recorded)} aria-describedby={productErrors.recorded ? ids.openingErr : undefined} disabled={busy} />
                  {productErrors.recorded && <p id={ids.openingErr} className="text-body-sm font-medium text-danger">{productErrors.recorded}</p>}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor={ids.cost} className="text-body-sm font-medium">Unit cost <span className="font-normal text-fg-tertiary">(optional, RM)</span></Label>
                  <Input id={ids.cost} type="number" inputMode="decimal" min={0} step="0.01" value={unitCost} onChange={(e) => { setUnitCost(e.target.value); setProductErrors((v) => ({ ...v, unitCost: undefined })) }}
                    aria-invalid={Boolean(productErrors.unitCost)} aria-describedby={productErrors.unitCost ? ids.costErr : undefined} disabled={busy} />
                  {productErrors.unitCost && <p id={ids.costErr} className="text-body-sm font-medium text-danger">{productErrors.unitCost}</p>}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor={ids.productNote} className="text-body-sm font-medium">Note <span className="font-normal text-fg-tertiary">(optional)</span></Label>
                  <Textarea id={ids.productNote} value={productNote} onChange={(e) => setProductNote(e.target.value)} rows={3} maxLength={4000} disabled={busy}
                    placeholder="Add a note about this product" className="min-h-24 rounded-[12px] border-line bg-elevated text-body" />
                </div>
                {productFormError && <p role="alert" className="text-body-sm text-danger">{productFormError}</p>}
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                  <Button type="button" variant="secondary" disabled={busy} onClick={leaveProductForm}>Back to count</Button>
                  <Button type="submit" disabled={busy}>{busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}{busy ? 'Saving…' : 'Next: add evidence'}</Button>
                </div>
              </form>
            </Card>
          )}

          {mode === 'evidence' && (
            <Card className="flex flex-col gap-5 p-5 md:p-6">
              <div>
                <p className="mb-1 text-caption text-fg-tertiary">{createdProduct ? 'Step 2 of 2' : 'Count submitted'}</p>
                <h2 ref={viewHeading} tabIndex={-1} className="text-h3 font-semibold outline-none">{createdProduct ? 'Add product evidence' : 'Explain the difference'}</h2>
                <p className="mt-1 text-body-sm text-fg-secondary">{createdProduct ? 'Add a delivery note, invoice or photo of the item.' : 'Add a photo or report that explains the difference.'}</p>
              </div>
              {createdProduct ? (
                <ProductEvidenceBlocked fileChoice={productEvidence} onFileChange={setProductEvidence} inputId={ids.evidenceFile} />
              ) : openedCase ? (
                <>
                  <CaseAttachments stockCase={openedCase} viewed={openedCase.versions[openedCase.versions.length - 1]} />
                  <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                    <Button type="button" variant="secondary" onClick={() => { setMode('complete'); setCompletion('case') }}>Skip for now</Button>
                    <Button type="button" onClick={() => { setMode('complete'); setCompletion('case') }}>Finish count</Button>
                  </div>
                  <p className="text-caption text-fg-tertiary">You can add documents later from this case page. Documents support human review only; they do not reconcile quantities or approve a case.</p>
                </>
              ) : null}
              {createdProduct && <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <Button type="button" variant="secondary" onClick={leaveProductEvidence}>Leave for later</Button>
                <Button type="button" disabled className="cursor-not-allowed" title="Product evidence upload is not available yet">
                  <Paperclip aria-hidden="true" /> Upload evidence unavailable
                </Button>
              </div>}
            </Card>
          )}

          {mode === 'complete' && (
            <Card className="flex flex-col gap-5 p-5 md:p-6" role="status">
              <div className="flex items-start gap-3">
                {completion === 'product-later' ? <AlertCircle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" /> : <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />}
                <div>
                  <h2 ref={viewHeading} tabIndex={-1} className="text-h3 font-semibold outline-none">
                    {completion === 'matched' ? 'Count submitted' : completion === 'case' ? `Count submitted · Case ${openedCase?.id ?? ''} opened` : completion === 'product-later' ? 'Product saved · Evidence missing' : 'Product added'}
                  </h2>
                  <p className="mt-1 text-body-sm text-fg-secondary">
                    {completion === 'matched' ? countMessage : completion === 'case' ? 'The case is open for review. You can add documents later from the case page.' : completion === 'product-later' ? 'The product is in your stock list, but evidence could not be uploaded because product evidence upload is not available yet.' : 'The product is saved. Product evidence upload is not available yet, so evidence is still missing.'}
                  </p>
                </div>
              </div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap">
                <Button type="button" variant="secondary" onClick={beginAnother}>Add another</Button>
                {completion === 'case' && openedCase
                  ? <Button type="button" onClick={() => navigate(`/cases/${openedCase.id}`)}>View case</Button>
                  : <Button type="button" onClick={() => navigate('/inbox')}>Go to Inbox</Button>}
              </div>
            </Card>
          )}
        </div>

        <StockSummaryPanel items={summary.items} matches={summary.matches} total={summary.total} updatedAt={summary.updatedAt}
          loading={loading} error={error} onRetry={() => { void refresh().catch(() => {}) }} selectedId={productId} />
      </div>
    </div>
  )
}

function ProductEvidenceBlocked({ fileChoice, onFileChange, inputId }: { fileChoice: FileChoice | null; onFileChange: (file: FileChoice | null) => void; inputId: string }) {
  const input = useRef<HTMLInputElement>(null)
  const [validation, setValidation] = useState('')
  const choose = (file?: File) => {
    if (!file) return
    setValidation('')
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) { setValidation('Use a JPG, PNG or PDF.'); return }
    if (file.size === 0) { setValidation('Choose a nonempty file.'); return }
    if (file.size > 10 * 1024 * 1024) { setValidation('File is over 10 MB.'); return }
    onFileChange({ file, description: '' })
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-body-sm text-fg-secondary">Photos and PDFs support human review only. They do not reconcile quantities, mark a discrepancy supported, or approve a case.</p>
      <div className="flex flex-col gap-4 rounded-[12px] border border-dashed border-line bg-elevated/40 p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-fill/10 text-accent-text"><Paperclip className="size-5" aria-hidden="true" /></span>
          <div><p className="text-body-sm font-medium">Add supporting evidence</p><p className="text-caption text-fg-secondary">JPG, PNG or PDF · Up to 10 MB</p></div>
        </div>
        <input id={inputId} ref={input} type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" className="sr-only" onChange={(e) => choose(e.target.files?.[0])} />
        <Button type="button" variant="secondary" onClick={() => input.current?.click()} className="self-start">{fileChoice ? 'Change file' : 'Select photo or PDF'}</Button>
        {fileChoice && <div role="status" className="flex min-w-0 items-center gap-3 rounded-lg border border-line bg-elevated p-3">
          {fileChoice.file.type === 'application/pdf' ? <FileText className="size-5 shrink-0 text-accent-text" aria-hidden="true" /> : <Paperclip className="size-5 shrink-0 text-accent-text" aria-hidden="true" />}
          <div className="min-w-0 flex-1"><p className="break-all text-body-sm font-medium">{fileChoice.file.name}</p><p className="text-caption text-fg-secondary">{(fileChoice.file.size / 1024).toFixed(0)} KB · Selected on this device only</p></div>
          <Button type="button" variant="ghost" size="icon" aria-label="Remove selected file" onClick={() => { onFileChange(null); if (input.current) input.current.value = '' }}><X aria-hidden="true" /></Button>
        </div>}
        {validation && <p role="alert" className="text-body-sm text-danger">{validation}</p>}
        <p className="text-body-sm text-fg-secondary">Product evidence upload is not available yet. This file has not been uploaded or saved.</p>
        <Button type="button" disabled={!fileChoice} title={!fileChoice ? 'Choose a file first' : 'Product evidence upload is not available yet'}><Paperclip aria-hidden="true" /> Upload evidence unavailable</Button>
        {!fileChoice && <p className="text-caption text-fg-tertiary">Choose a file first. Upload remains unavailable until a product evidence endpoint is added.</p>}
      </div>
    </div>
  )
}

function StockSummaryPanel({ items, matches, total, updatedAt, loading, error, onRetry, selectedId }: {
  items: StockSummaryItem[]; matches: number; total: number; updatedAt: string; loading: boolean; error: string | null; onRetry: () => void; selectedId: string
}) {
  const ordered = [...items].sort((a, b) => {
    const rank = (i: StockSummaryItem) => i.status === 'difference' ? 0 : i.status === 'not_counted' ? 1 : 2
    return rank(a) - rank(b) || a.name.localeCompare(b.name)
  }).slice(0, 6)
  const updatedLabel = updatedAt ? `Last updated ${formatDateTime(updatedAt)}` : ''
  return (
    <Card className="flex min-w-0 flex-col gap-4 p-5 lg:sticky lg:top-5">
      <div>
        <h2 className="text-h3 font-semibold">Stock summary</h2>
        <p className="text-body-sm text-fg-secondary">Counted vs recorded</p>
      </div>
      {loading ? <div aria-busy="true" aria-label="Loading stock summary" className="flex flex-col gap-3">
        <Skeleton className="h-8 w-40" />{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-[12px]" />)}
      </div> : error ? <ErrorNotice title="Could not load the stock summary" description={error} onRetry={onRetry} /> : items.length === 0 ? (
        <EmptyState title="No products yet." description="Add your first product." />
      ) : <>
        <p className="num text-h2 font-semibold" data-testid="text-summary-matches">{matches} of {total} match</p>
        <ul className="flex flex-col gap-2" aria-label="Stock summary products">
          {ordered.map((item) => <SummaryRow key={item.productId} item={item} selected={item.productId === selectedId} />)}
        </ul>
      </>}
      {updatedLabel && !loading && !error && <p className="text-caption text-fg-tertiary" data-testid="text-summary-updated">{updatedLabel}</p>}
      <Link href="/reports" className="inline-flex min-h-11 items-center gap-2 border-t border-line pt-3 text-body-sm font-medium text-accent-text hover:underline" data-testid="link-full-summary">
        View full summary <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </Card>
  )
}

function SummaryRow({ item, selected }: { item: StockSummaryItem; selected: boolean }) {
  const counted = item.counted
  const ratio = counted === null || item.recorded <= 0 ? (counted === item.recorded ? 100 : 0) : Math.min(100, Math.max(0, (counted / item.recorded) * 100))
  const difference = item.difference
  const state = item.status === 'matched'
    ? { label: 'Matches record', tone: 'success' as const, icon: CheckCircle2 }
    : item.status === 'not_counted'
      ? { label: 'Not counted', tone: 'neutral' as const, icon: AlertCircle }
      : difference !== null && difference < 0
        ? { label: `${formatSigned(difference)} below`, tone: 'warning' as const, icon: ArrowDown }
        : { label: `${formatSigned(difference ?? 0)} above`, tone: 'neutral' as const, icon: ArrowUp }
  return (
    <li>
      <Link href="/reports" data-testid={`link-summary-product-${item.productId}`} className={`block min-h-11 rounded-[12px] border p-3 transition-colors hover:bg-elevated ${selected ? 'border-accent-text bg-elevated' : 'border-line'}`}>
        <div className="flex min-w-0 items-start justify-between gap-2">
          <span className="min-w-0 truncate text-body-sm font-medium">{item.name}</span>
          <span className="num shrink-0 text-caption text-fg-secondary">{counted === null ? '—' : counted} / {item.recorded}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-elevated" role="progressbar" aria-label={`${item.name} counted against recorded`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio)}>
          <div className="h-full rounded-full bg-accent-fill" style={{ width: `${ratio}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Pill tone={state.tone} icon={state.icon}>{state.label}</Pill>
          {item.evidenceMissing && <Pill tone="warning" icon={AlertCircle}>Evidence missing</Pill>}
        </div>
      </Link>
    </li>
  )
}
