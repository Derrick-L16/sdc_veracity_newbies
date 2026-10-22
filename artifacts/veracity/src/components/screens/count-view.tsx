import { useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { AlertTriangle, ArrowRight, ArrowUpRight, CheckCircle2, ChevronDown, FileText, Loader2, Paperclip, Plus, Send, X } from 'lucide-react'
import { Link, useLocation } from 'wouter'
import { toast } from 'sonner'
import { useApp } from '@/components/app/app-provider'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CaseAttachments } from '@/components/veracity/case-attachments'
import { NoDifferenceBadge, Pill } from '@/components/veracity/badges'
import { Card, ErrorNotice, PageHeader, StatTile } from '@/components/veracity/primitives'
import { formatSigned } from '@/lib/format'
import type { StockSummaryItem } from '@/lib/stock'
import type { Product, StockCase } from '@/lib/types'
import { cn } from '@/lib/utils'

type Mode = 'count' | 'product' | 'evidence' | 'complete'
type Flow = 'count' | 'product' | null

export function CountView() {
  const [, navigate] = useLocation()
  const { submitCount, createProduct, findOpenCase, role, products, summary, loading, error, refresh } = useApp()
  const [mode, setMode] = useState<Mode>('count')
  const [flow, setFlow] = useState<Flow>(null)
  const [productId, setProductId] = useState('')
  const [counted, setCounted] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [newName, setNewName] = useState('')
  const [newRecorded, setNewRecorded] = useState('')
  const [newCost, setNewCost] = useState('')
  const [newNote, setNewNote] = useState('')
  const [productError, setProductError] = useState('')
  const [productSubmitted, setProductSubmitted] = useState(false)
  const [newProduct, setNewProduct] = useState<Product | null>(null)
  const [newCase, setNewCase] = useState<StockCase | null>(null)
  const [productFile, setProductFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const actionRef = useRef<HTMLButtonElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const ids = { product: useId(), counted: useId(), note: useId(), name: useId(), recorded: useId(), cost: useId(), newNote: useId() }
  const product = products.find((item) => item.id === productId)
  const countedNum = counted === '' ? null : Number(counted)
  const countedValid = countedNum !== null && Number.isInteger(countedNum) && countedNum >= 0
  const difference = product && countedValid ? countedNum - product.recorded : null
  const duplicateCase = product && countedValid ? findOpenCase(product.name, countedNum) : undefined
  const nameDuplicate = products.some((item) => item.name.trim().toLowerCase() === newName.trim().toLowerCase())
  const countedError = (submitted && !countedValid) || (countedNum !== null && countedNum < 0)
  const productMissing = submitted && !product
  const canWrite = role === 'staff' || role === 'manager'
  const nameError = nameDuplicate || productError.toLowerCase().includes('already exists')
    ? 'A product with this name already exists. Count it instead.'
    : productSubmitted && !newName.trim() ? 'Enter a product name.' : ''
  const newRecordedNumber = newRecorded === '' ? NaN : Number(newRecorded)
  const recordedError = productSubmitted && (!Number.isInteger(newRecordedNumber) || newRecordedNumber < 0 || newRecordedNumber > 1_000_000_000)
    ? 'Enter a whole number of 0 or more.' : ''
  const newCostNumber = newCost === '' ? undefined : Number(newCost)
  const costError = productSubmitted && newCostNumber !== undefined && (!Number.isFinite(newCostNumber) || newCostNumber < 0 || newCostNumber > 1_000_000_000)
    ? 'Enter a unit cost of 0 or more.' : ''

  const focusAction = () => requestAnimationFrame(() => actionRef.current?.focus())
  const selectMode = (next: Mode) => { setMode(next); focusAction() }

  const reset = () => {
    setMode('count'); setFlow(null); setProductId(''); setCounted(''); setNote(''); setSubmitted(false)
    setNewName(''); setNewRecorded(''); setNewCost(''); setNewNote(''); setProductError(''); setProductSubmitted(false)
    setNewProduct(null); setNewCase(null); setProductFile(null); setFileError('')
    if (fileInput.current) fileInput.current.value = ''
    focusAction()
  }

  const goBack = () => {
    const unsaved = mode === 'product' ? Boolean(newName || newRecorded || newCost || newNote)
      : mode === 'evidence' && flow === 'product' ? Boolean(productFile)
        : false
    if (unsaved && !window.confirm('Discard changes?')) return
    if (mode === 'product') { selectMode('count'); return }
    if (mode === 'evidence') { setProductFile(null); selectMode('count'); return }
    selectMode('count')
  }

  async function handleSubmitCount(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (!canWrite || !product || !countedValid || duplicateCase) return
    setBusy(true)
    try {
      const created = await submitCount({ product: product.name, recorded: product.recorded, counted: countedNum, note: note.trim() })
      setFlow('count')
      if (!created) {
        toast.success('Count matches the record. Saved.')
        setNewCase(null)
        setMode('complete')
      } else {
        setNewCase(created)
        setMode('evidence')
      }
    } catch (e) { toast.error((e as Error).message) }
    finally { setBusy(false) }
  }

  async function submitProduct(event: FormEvent) {
    event.preventDefault()
    setProductSubmitted(true)
    setProductError('')
    if (!canWrite) return
    const name = newName.trim()
    const recorded = newRecorded === '' ? NaN : Number(newRecorded)
    const cost = newCost === '' ? undefined : Number(newCost)
    if (!name || !Number.isInteger(recorded) || recorded < 0 || recorded > 1_000_000_000 || (cost !== undefined && (!Number.isFinite(cost) || cost < 0 || cost > 1_000_000_000))) return
    if (nameDuplicate) { setProductError('A product with this name already exists. Count it instead.'); return }
    setBusy(true)
    try {
      const created = await createProduct({ name, recorded, ...(cost === undefined ? {} : { unit_cost: cost }), ...(newNote.trim() ? { note: newNote.trim() } : {}) })
      setNewProduct(created)
      setFlow('product')
      setProductFile(null)
      setMode('evidence')
    } catch (e) {
      const message = (e as Error).message
      setProductError(message.toLowerCase().includes('already exists') ? 'A product with this name already exists. Count it instead.' : message)
    } finally { setBusy(false) }
  }

  const validateProductFile = (file: File | null) => {
    setProductFile(file)
    setFileError('')
    if (!file) return
    const validMime = ['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)
    const validName = /\.(jpe?g|png|pdf)$/i.test(file.name)
    if (!validMime || !validName) setFileError('Use a JPG, PNG or PDF')
    else if (file.size > 10 * 1024 * 1024) setFileError('File is over 10 MB')
    else if (!file.size) setFileError('Choose a nonempty file.')
  }

  const headerAction = mode === 'count' || mode === 'complete' ? (
    <Button ref={actionRef} type="button" variant="outline" disabled={!canWrite} title={!canWrite ? 'Permission required: Staff or Manager' : undefined} onClick={() => selectMode('product')}>
      <Plus aria-hidden="true" /> Add New Product
    </Button>
  ) : (
    <Button ref={actionRef} type="button" variant="secondary" onClick={goBack}>Back to count</Button>
  )

  const heading = mode === 'product' ? 'Add new product' : mode === 'evidence' ? 'Upload evidence' : mode === 'complete' ? 'Count complete' : 'New count'
  const subtitle = mode === 'count' ? 'Enter what you counted on the shelf. Veracity compares it with the record.' : undefined

  return (
    <div className="flex flex-col gap-6" data-testid="page-count">
      <PageHeader title={heading} subtitle={subtitle}>{headerAction}</PageHeader>
      {role === 'owner' && <ErrorNotice title="Permission required" description="Owners have read-only access. Switch to Staff or Manager to count stock or add a product." />}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="min-w-0">
          {mode === 'count' && renderCountForm()}
          {mode === 'product' && (
            <Card className="p-5 md:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div><h2 className="text-h2 font-semibold">Add new product</h2><p className="text-body-sm text-fg-secondary">Step 1 of 2</p></div>
              </div>
              <form onSubmit={submitProduct} noValidate className="flex flex-col gap-4">
                <Field label="Product name" id={ids.name} error={nameError} errorId={`${ids.name}-error`}>
                  <Input id={ids.name} value={newName} onChange={(e) => { setNewName(e.target.value); setProductError('') }} aria-invalid={Boolean(nameError)} aria-describedby={nameError ? `${ids.name}-error` : undefined} maxLength={4000} className="h-12 text-body" />
                </Field>
                <Field label="Recorded (opening) quantity" id={ids.recorded} error={recordedError} errorId={`${ids.recorded}-error`}>
                  <Input id={ids.recorded} type="number" inputMode="numeric" min={0} max={1_000_000_000} step={1} value={newRecorded} onChange={(e) => setNewRecorded(e.target.value)} aria-invalid={Boolean(recordedError)} aria-describedby={recordedError ? `${ids.recorded}-error` : undefined} className="h-12 text-body" />
                </Field>
                <Field label={<>Unit cost <span className="text-fg-tertiary">(RM, optional)</span></>} id={ids.cost}>
                  <Input id={ids.cost} type="number" min={0} step="0.01" value={newCost} onChange={(e) => setNewCost(e.target.value)} aria-invalid={Boolean(costError)} aria-describedby={costError ? `${ids.cost}-error` : undefined} className="h-12 text-body" />
                </Field>
                {costError && <p id={`${ids.cost}-error`} className="text-body-sm text-danger">{costError}</p>}
                <Field label={<>Note <span className="text-fg-tertiary">(optional)</span></>} id={ids.newNote}>
                  <Textarea id={ids.newNote} value={newNote} onChange={(e) => setNewNote(e.target.value)} rows={3} maxLength={4000} className="min-h-24 text-body" />
                </Field>
                {productError && !productError.toLowerCase().includes('already exists') && <p role="alert" className="text-body-sm text-danger">{productError}</p>}
                <div className="flex flex-wrap gap-3">
                  <Button type="button" variant="secondary" onClick={goBack} className="min-h-11">Back to count</Button>
                  <Button type="submit" disabled={busy || !canWrite} className="min-h-11">{busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}Next: add evidence</Button>
                </div>
              </form>
            </Card>
          )}
          {mode === 'evidence' && flow === 'count' && newCase && newCase.versions.length > 0 && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between"><div><h2 className="text-h2 font-semibold">Upload evidence</h2><p className="text-body-sm text-fg-secondary">Step 2 of 2 · Case {newCase.id}</p></div></div>
              <CaseAttachments
                stockCase={newCase}
                viewed={newCase.versions[newCase.versions.length - 1]}
                helperText="Add a photo or report that explains the difference."
                completionMode
                onDone={() => setMode('complete')}
              />
              <p className="text-body-sm text-fg-secondary">You can add documents later from the case page.</p>
              <Button type="button" variant="secondary" onClick={() => setMode('complete')} className="self-start">Skip for now</Button>
            </div>
          )}
          {mode === 'evidence' && flow === 'product' && newProduct && (
            <ProductEvidenceStep product={newProduct} file={productFile} fileError={fileError} fileInput={fileInput} onFile={validateProductFile} onDone={() => setMode('complete')} />
          )}
          {mode === 'complete' && (
            <Card className="flex flex-col gap-4 p-5 md:p-6" data-testid="card-count-complete">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-6 text-success" aria-hidden="true" />
                <div>
                  <h2 className="text-h2 font-semibold">{flow === 'product' ? 'Product added' : newCase ? `Count submitted · Case ${newCase.id} opened` : 'No difference. Nothing to upload.'}</h2>
                  {flow === 'product' && <p className="mt-1 text-body-sm text-warning">Evidence missing. Product-level uploads need a backend endpoint before this file can be saved.</p>}
                  {newCase && <p className="mt-1 text-body-sm text-fg-secondary">You can add documents later from the case page.</p>}
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="button" onClick={reset} className="min-h-11">Add another</Button>
                {newCase ? <Button type="button" variant="secondary" onClick={() => navigate(`/cases/${newCase.id}`)} className="min-h-11">View case</Button>
                  : <Button type="button" variant="secondary" onClick={() => navigate('/inbox')} className="min-h-11">Go to Inbox</Button>}
              </div>
            </Card>
          )}
        </div>
        <StockSummaryPanel
          items={summary.items}
          matches={summary.matches}
          total={summary.total}
          updatedAt={summary.updatedAt}
          loading={loading}
          error={error}
          selectedId={productId || newProduct?.id || ''}
          role={role}
          onRetry={() => { void refresh().catch(() => {}) }}
        />
      </div>
    </div>
  )

  function renderCountForm() {
    return (
      <Card className="p-5 md:p-6">
        <form onSubmit={handleSubmitCount} noValidate className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor={ids.product} className="text-body-sm font-medium">Product</Label>
            <div className="relative">
              <select id={ids.product} value={productId} onChange={(e) => setProductId(e.target.value)} aria-invalid={productMissing} aria-describedby={productMissing ? `${ids.product}-error` : undefined} className="h-12 w-full appearance-none rounded-[12px] border border-line bg-elevated px-4 pr-10 text-body text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent-text aria-invalid:border-danger">
                <option value="">Choose a product</option>
                {products.map((item) => <option key={item.id} value={item.id}>{item.name}{item.evidence_missing ? ' · Evidence missing' : ''}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-fg-secondary" aria-hidden="true" />
            </div>
            {productMissing && <p id={`${ids.product}-error`} className="text-body-sm font-medium text-danger">Choose a product.</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Recorded stock" value={product ? product.recorded : '—'} />
            <StatTile label="Difference" value={difference === null ? '—' : formatSigned(difference)} tone={difference ? 'accent' : 'default'} />
          </div>
          <Field label="Counted quantity" id={ids.counted} error={countedError ? countedNum !== null && countedNum < 0 ? 'Counted quantity cannot be less than 0.' : 'Enter a whole number of 0 or more.' : ''} errorId={`${ids.counted}-error`}>
            <Input id={ids.counted} type="number" inputMode="numeric" min={0} max={1_000_000_000} step={1} value={counted} onChange={(e) => setCounted(e.target.value)} aria-invalid={countedError} aria-describedby={countedError ? `${ids.counted}-error` : undefined} className="num h-14 rounded-[12px] border-line bg-elevated px-4 text-h2 font-semibold text-white" placeholder="0" />
          </Field>
          {difference === 0 && <NoDifferenceBadge />}
          {duplicateCase && <ErrorNotice title="A case for this count is already open." description={`${duplicateCase.id} has the same product and count. Open it instead of creating a duplicate.`} action={<Link href={`/cases/${duplicateCase.id}`} className="text-body-sm font-medium text-accent-text underline-offset-4 hover:underline">Open {duplicateCase.id}</Link>} />}
          <Field label={<>Note <span className="font-normal text-fg-tertiary">(optional)</span></>} id={ids.note}>
            <Textarea id={ids.note} value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Where you counted, anything unusual" className="min-h-24 rounded-[12px] border-line bg-elevated text-body" />
          </Field>
          <Button type="submit" size="lg" disabled={busy || !canWrite || Boolean(duplicateCase)} title={!canWrite ? 'Permission required: Staff or Manager' : undefined}>
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}{busy ? 'Submitting…' : 'Submit count'}
          </Button>
        </form>
      </Card>
    )
  }
}

function Field({ label, id, children, error, errorId }: { label: React.ReactNode; id: string; children: React.ReactNode; error?: string; errorId?: string }) {
  return <div className="flex flex-col gap-2"><Label htmlFor={id} className="text-body-sm font-medium">{label}</Label>{children}{error && <p id={errorId} className="text-body-sm font-medium text-danger">{error}</p>}</div>
}

function ProductEvidenceStep({ product, file, fileError, fileInput, onFile, onDone }: {
  product: Product; file: File | null; fileError: string; fileInput: React.RefObject<HTMLInputElement | null>
  onFile: (file: File | null) => void; onDone: () => void
}) {
  return (
    <Card className="flex flex-col gap-4 p-5 md:p-6">
      <div><h2 className="text-h2 font-semibold">Upload evidence</h2><p className="text-body-sm text-fg-secondary">Step 2 of 2 · {product.name}</p></div>
      <p className="text-body-sm text-fg-secondary">Add a delivery note, invoice or photo of the item.</p>
      <p className="text-body-sm text-fg-secondary">Photos and PDFs support human review only. They do not reconcile quantities, mark a discrepancy supported, or approve a case.</p>
      <div className="rounded-[12px] border border-line bg-elevated p-4">
        <label htmlFor="new-product-evidence-file" className="mb-2 block text-body-sm font-medium">Evidence file</label>
        <p className="text-body-sm font-medium">JPG, PNG or PDF · Up to 10 MB</p>
        <input ref={fileInput} id="new-product-evidence-file" type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" className="sr-only" aria-describedby="new-product-evidence-help" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        <span id="new-product-evidence-help" className="sr-only">Choose a JPG, PNG or PDF up to 10 MB.</span>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" onClick={() => fileInput.current?.click()} className="min-h-11"><Paperclip aria-hidden="true" />{file ? 'Change file' : 'Select photo or PDF'}</Button>
          {file && <Button type="button" variant="ghost" size="icon" aria-label="Remove selected file" onClick={() => { onFile(null); if (fileInput.current) fileInput.current.value = '' }}><X aria-hidden="true" /></Button>}
        </div>
        {file && <div role="status" className="mt-3 flex items-center gap-3 rounded-lg border border-line p-3"><FileText className="size-5 text-accent-text" aria-hidden="true" /><div className="min-w-0"><p className="break-all text-body-sm font-medium">{file.name}</p><p className="text-caption text-fg-secondary">{(file.size / 1024).toFixed(0)} KB · Kept in this form only</p></div></div>}
        {fileError && <p role="alert" className="mt-3 text-body-sm text-danger">{fileError}</p>}
      </div>
      {file && <p className="text-body-sm text-fg-secondary">Selected file: {file.name} · {file.size < 1024 * 1024 ? `${Math.ceil(file.size / 1024)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}</p>}
      <ErrorNotice title="Product evidence is not available yet" description="This app has no product-level evidence API. The selected file has not been uploaded. The backend must add reserve upload, upload, finalize, and link-to-product endpoints with the same 10 MB, file-type, and role checks as case evidence." />
      <p className="text-caption text-fg-tertiary">TODO: connect product-level evidence API before enabling uploads. The new product remains marked Evidence missing.</p>
      <Button type="button" disabled title={!file ? 'Choose a file first' : fileError || 'Product evidence API is not available yet'} className="self-start min-h-11"><Paperclip aria-hidden="true" />Upload evidence</Button>
      <Button type="button" onClick={onDone} className="self-start min-h-11">Done</Button>
    </Card>
  )
}

function StockSummaryPanel({ items, matches, total, updatedAt, loading, error, selectedId, role, onRetry }: {
  items: StockSummaryItem[]; matches: number; total: number; updatedAt: string; loading: boolean; error: string | null
  selectedId: string; role: string; onRetry: () => void
}) {
  const [compactOpen, setCompactOpen] = useState(false)
  const visible = useMemo(() => {
    const selected = items.find(item => item.productId === selectedId)
    const subset = items.slice(0, 6)
    if (selected && !subset.some(item => item.productId === selectedId)) subset[5] = selected
    return subset.sort((a, b) => {
      const rank = (item: StockSummaryItem) => item.difference === null ? 1 : item.difference === 0 ? 2 : 0
      return rank(a) - rank(b)
    })
  }, [items, selectedId])
  const updated = updatedAt ? new Date(updatedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
  const fullSummary = role === 'staff' ? '/inbox' : '/reports'
  return (
    <Card className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-5" aria-labelledby="count-stock-summary">
      <div>
        <h2 id="count-stock-summary" className="text-h3 font-semibold">Stock summary</h2>
        <p className="text-body-sm text-fg-secondary">Counted vs recorded</p>
      </div>
      {loading ? <div aria-busy="true" aria-label="Loading stock summary" className="flex flex-col gap-3">{[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-[10px] bg-elevated" />)}</div>
        : error ? <ErrorNotice title="Could not load stock summary" description={error} onRetry={onRetry} />
          : <>
            <p className="num text-h2 font-semibold" data-testid="text-stock-matches">{matches} of {total} match</p>
            <button type="button" className="min-h-11 self-start text-body-sm font-medium text-accent-text underline-offset-4 hover:underline lg:hidden" onClick={() => setCompactOpen((open) => !open)} aria-expanded={compactOpen}>{compactOpen ? 'Hide full summary' : 'View full summary'}</button>
            {items.length === 0 ? <p className="text-body-sm text-fg-secondary">No products yet. Add your first product.</p>
              : <ul className={cn('flex-col divide-y divide-line', compactOpen ? 'flex' : 'hidden lg:flex')} aria-label="Products counted vs recorded">
                {visible.map((item) => <SummaryRow key={item.productId} item={item} selected={item.productId === selectedId} />)}
              </ul>}
            <p className="text-caption text-fg-tertiary">Last updated {updated}</p>
            <Link href={fullSummary} className="self-start text-body-sm font-medium text-accent-text underline-offset-4 hover:underline">View full summary <ArrowRight className="inline size-4" aria-hidden="true" /></Link>
          </>}
    </Card>
  )
}

function SummaryRow({ item, selected }: { item: StockSummaryItem; selected: boolean }) {
  const counted = item.counted ?? 0
  const denominator = Math.max(item.recorded, counted, 1)
  const progress = item.counted === null ? 0 : Math.min(100, Math.round(counted / denominator * 100))
  const difference = item.difference
  const status = item.status === 'not_counted'
    ? <Pill tone="neutral" icon={AlertTriangle}>Not counted</Pill>
    : difference === 0
      ? <Pill tone="success" icon={CheckCircle2}>Matches</Pill>
      : difference! < 0
        ? <span className="inline-flex items-center gap-1.5 text-caption font-medium text-danger"><AlertTriangle className="size-3.5" aria-hidden="true" />Short by {Math.abs(difference!)}</span>
        : <span className="inline-flex items-center gap-1.5 text-caption font-medium text-accent-text"><ArrowUpRight className="size-3.5 text-fg-secondary" aria-hidden="true" />More by {difference}</span>
  return (
    <li>
      <Link href={`/reports?product=${encodeURIComponent(item.productId)}`} className={cn('flex min-h-11 flex-col gap-1.5 rounded-[10px] px-2 py-3 hover:bg-elevated focus-visible:outline-2 focus-visible:outline-accent-text', selected && 'bg-accent-fill/10 ring-1 ring-accent-text')} data-testid={`link-summary-product-${item.productId}`}>
        <span className="flex min-w-0 items-center justify-between gap-2"><span className="truncate text-body-sm font-medium">{item.name}</span>{item.evidenceMissing && <span className="shrink-0 rounded-full tint-warning px-2 py-0.5 text-caption text-warning">Evidence missing</span>}</span>
        <span className="num text-caption text-fg-secondary">{item.counted === null ? 'Not counted' : `${item.counted} counted · ${item.recorded} recorded`}</span>
        <span className="h-1.5 w-full overflow-hidden rounded-full bg-elevated" role="progressbar" aria-label={`${item.name} counted stock`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span className="block h-full rounded-full bg-accent-fill" style={{ width: `${progress}%` }} /></span>
        {status}
      </Link>
    </li>
  )
}
