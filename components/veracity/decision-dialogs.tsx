'use client'

import { CheckCircle2, Loader2 } from 'lucide-react'
import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const CONTENT_CLASS = 'gap-5 rounded-[20px] border border-line bg-surface p-5 ring-0 sm:max-w-md'

export function ImpactPreviewDialog({
  open,
  onOpenChange,
  impact,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  impact: string[]
  onConfirm: () => Promise<void> | void
}) {
  const [busy, setBusy] = useState(false)
  const confirm = async () => {
    setBusy(true)
    await onConfirm()
    setBusy(false)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={CONTENT_CLASS}>
        <DialogHeader className="gap-2">
          <DialogTitle className="text-h2 font-semibold">Approve this correction?</DialogTitle>
          <DialogDescription className="text-body text-fg-secondary">Approving will:</DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-2">
          {impact.map((line) => (
            <li key={line} className="flex items-start gap-2 text-body">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
              <span className="num">{line}</span>
            </li>
          ))}
        </ul>
        <DialogFooter className="-mx-0 -mb-0 flex-col-reverse gap-2 border-0 bg-transparent p-0 sm:flex-row">
          <DialogClose render={<Button variant="secondary" />}>Cancel</DialogClose>
          <Button size="lg" onClick={confirm} disabled={busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
            {busy ? 'Approving…' : 'Confirm approval'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  onConfirm: (reason: string) => Promise<void> | void
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const fieldId = useId()
  const errorId = useId()
  const hintId = useId()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) {
      setError(true)
      return
    }
    setBusy(true)
    await onConfirm(reason.trim())
    setBusy(false)
    setReason('')
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setError(false)
          setReason('')
        }
        onOpenChange(o)
      }}
    >
      <DialogContent className={CONTENT_CLASS}>
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <DialogHeader className="gap-2">
            <DialogTitle className="text-h2 font-semibold">{title}</DialogTitle>
            <DialogDescription className="text-body text-fg-secondary">{description}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor={fieldId} className="text-body-sm font-medium">
              Reason
            </Label>
            <Textarea
              id={fieldId}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                if (error && e.target.value.trim()) setError(false)
              }}
              aria-invalid={error}
              aria-describedby={error ? `${errorId} ${hintId}` : hintId}
              rows={4}
              className="min-h-28 rounded-[12px] border-line bg-elevated text-body"
            />
            <p id={hintId} className="text-body-sm text-fg-secondary">
              Saved permanently in the Decision Passport.
            </p>
            {error && (
              <p id={errorId} role="alert" className="text-body-sm font-medium text-danger">
                Enter a reason. It will be saved permanently.
              </p>
            )}
          </div>
          <DialogFooter className="-mx-0 -mb-0 flex-col-reverse gap-2 border-0 bg-transparent p-0 sm:flex-row">
            <DialogClose render={<Button type="button" variant="secondary" />}>Cancel</DialogClose>
            <Button type="submit" size="lg" disabled={busy}>
              {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
              {busy ? 'Saving…' : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
