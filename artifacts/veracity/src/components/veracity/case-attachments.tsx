import { useId, useRef, useState } from 'react'
import { FileText, Image, Paperclip, Upload, X } from 'lucide-react'
import { useApp } from '@/components/app/app-provider'
import { Button } from '@/components/ui/button'
import { Card } from './primitives'
import { formatDateTime } from '@/lib/format'
import type { DecisionVersion, StockCase } from '@/lib/types'
import { attachmentURL, uploadEvidence, type UploadAttempt } from '@/lib/evidence-upload'

export function CaseAttachments({ stockCase, viewed, historical = false, readOnly = false }: {
  stockCase: StockCase; viewed: DecisionVersion; historical?: boolean; readOnly?: boolean
}) {
  const { role, user, refresh } = useApp()
  const fieldId = useId()
  const [file, setFile] = useState<File | null>(null)
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [phase, setPhase] = useState('')
  const [progress, setProgress] = useState(0)
  const [saved, setSaved] = useState(false)
  const attempt = useRef<UploadAttempt>({ requestKey: crypto.randomUUID() })
  const input = useRef<HTMLInputElement>(null)
  const closed = stockCase.status === 'completed' || stockCase.status === 'rejected'
  const canUpload = !closed && !historical && !readOnly &&
    (role === 'manager' || (role === 'staff' && stockCase.createdBy === user.name))
  const attachments = (stockCase.attachments ?? []).filter(a => !historical || viewed.attachmentIds?.includes(a.id))

  function newAttempt() {
    attempt.current = { requestKey: crypto.randomUUID() }
    setError(''); setSaved(false); setPhase(''); setProgress(0)
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!file || busy) return
    setError(''); setSaved(false)
    const extensions: Record<string, RegExp> = { 'image/jpeg': /\.jpe?g$/i, 'image/png': /\.png$/i, 'application/pdf': /\.pdf$/i }
    if (!extensions[file.type]?.test(file.name)) { setError('Choose a JPEG, PNG or PDF with a matching filename extension.'); return }
    if (file.size === 0 || file.size > 10 * 1024 * 1024) { setError('Choose a nonempty file no larger than 10 MB.'); return }
    setBusy(true)
    try {
      await uploadEvidence(stockCase.id, viewed.version, file, description, attempt.current, (value, label) => { setProgress(value); setPhase(label) })
      setSaved(true); setFile(null); setDescription('')
      if (input.current) input.current.value = ''
      attempt.current = { requestKey: crypto.randomUUID() }
      try { await refresh() } catch { setError('Evidence was saved, but the list could not refresh. Reload this case to see it; do not upload it again.') }
    } catch (e) {
      setError((e as Error).message)
    } finally { setBusy(false) }
  }
  return (
    <Card className="flex min-w-0 flex-col gap-4 p-5 md:p-6">
      <h2 className="flex items-center gap-2 text-h3 font-semibold"><Paperclip className="size-5" aria-hidden="true" />Case documents</h2>
      <p className="text-body-sm text-fg-secondary">Photos and PDFs support human review only. They do not reconcile quantities, mark a discrepancy supported, or approve a case.</p>
      {historical && <p className="text-body-sm text-fg-secondary">Only documents available when assessment v{viewed.version} was created are shown.</p>}
      {attachments.length ? <ul className="flex flex-col gap-3" aria-label="Saved case evidence">
        {attachments.map(a => {
          const url = attachmentURL(stockCase.id, a.id, historical ? viewed.version : undefined)
          return <li key={a.id} className="flex min-w-0 flex-col gap-2 rounded-[12px] border border-line p-3">
            <a href={url} target="_blank" rel="noopener noreferrer" className="min-h-11 break-words text-body-sm font-medium text-accent-text underline underline-offset-4">
              {a.filename}{a.contentType === 'application/pdf' ? ' — Download PDF' : ' — Open image'}
            </a>
            {a.contentType !== 'application/pdf' && <img src={url} alt={`Evidence: ${a.description || a.filename}`} loading="lazy" className="max-h-48 max-w-full self-start rounded-lg object-contain" />}
            {a.description && <p className="break-words text-body-sm">{a.description}</p>}
            <p className="text-caption text-fg-secondary">{a.uploader} · {formatDateTime(a.uploadedAt)} · {(a.size / 1024).toFixed(0)} KB</p>
          </li>
        })}
      </ul> : <p className="text-body-sm text-fg-secondary">{historical ? 'No documents were available at this assessment.' : 'No documents uploaded yet.'}</p>}
      {canUpload ? <form onSubmit={submit} className="flex flex-col gap-3 border-t border-line pt-4" aria-label="Add case documents">
        <label htmlFor={`${fieldId}-file`} className="sr-only">Evidence file</label>
        <input ref={input} id={`${fieldId}-file`} type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" disabled={busy}
          aria-describedby={`${fieldId}-help`} onChange={e => { setFile(e.target.files?.[0] ?? null); newAttempt() }}
          tabIndex={-1} className="sr-only" />
        <div className="flex min-w-0 flex-col gap-4 rounded-[12px] border border-dashed border-line bg-elevated/40 p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-fill/10 text-accent-text">
              <Upload className="size-5" aria-hidden="true" />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-body-sm font-medium">Add supporting evidence</p>
              <p id={`${fieldId}-help`} className="text-caption text-fg-secondary">Select a receipt, damage photo, or report.<br />JPG, PNG or PDF · Up to 10 MB</p>
            </div>
          </div>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => input.current?.click()}
            aria-describedby={`${fieldId}-help`} className="self-start">
            <Paperclip aria-hidden="true" />{file ? 'Change file' : 'Select photo or PDF'}
          </Button>
          {file && <div role="status" className="flex min-w-0 items-center gap-3 rounded-lg border border-line bg-elevated p-3">
            {file.type === 'application/pdf' ? <FileText className="size-5 shrink-0 text-accent-text" aria-hidden="true" /> : <Image className="size-5 shrink-0 text-accent-text" aria-hidden="true" />}
            <div className="min-w-0 flex-1">
              <p className="break-all text-body-sm font-medium">{file.name}</p>
              <p className="text-caption text-fg-secondary">{file.size < 1024 * 1024 ? `${Math.max(1, Math.ceil(file.size / 1024))} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`} · Ready to upload</p>
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label="Remove selected file" disabled={busy} onClick={() => {
              setFile(null)
              if (input.current) input.current.value = ''
              newAttempt()
            }}><X aria-hidden="true" /></Button>
          </div>}
        </div>
        <label htmlFor={`${fieldId}-description`} className="text-body-sm font-medium">Description (optional)</label>
        <textarea id={`${fieldId}-description`} value={description} maxLength={1000} disabled={busy} rows={2}
          onChange={e => { setDescription(e.target.value); newAttempt() }} className="rounded-lg border border-line bg-elevated p-3 text-body-sm" />
        {busy && <progress aria-label="Evidence upload progress" max={100} value={progress} className="w-full" />}
        <p role="status" className="text-body-sm text-fg-secondary">{busy ? `${phase} ${progress}%` : saved ? 'Evidence saved for human review.' : ''}</p>
        {error && <p role="alert" className="break-words text-body-sm text-danger">{error}</p>}
        <Button type="submit" disabled={!file || busy} className="self-start"><Upload aria-hidden="true" />{busy ? 'Uploading…' : error && !saved ? 'Retry upload' : 'Upload evidence'}</Button>
      </form> : <p className="text-body-sm text-fg-secondary">{historical ? 'Historical evidence is read-only.' : closed || readOnly ? 'Evidence is read-only after a decision.' : 'Owners have read-only evidence access.'}</p>}
    </Card>
  )
}
