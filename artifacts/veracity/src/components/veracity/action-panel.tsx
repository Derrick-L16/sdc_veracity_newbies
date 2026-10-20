
import { Check, Eye, MoreHorizontal, PenLine, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useApp } from '@/components/app/app-provider'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { StockCase } from '@/lib/types'
import { ImpactPreviewDialog, ReasonDialog } from './decision-dialogs'
import { ErrorNotice } from './primitives'

type DialogKind = 'approve' | 'reject' | 'review' | 'override' | null


export function ActionPanel({ stockCase }: { stockCase: StockCase }) {
  const { role, decide, requestReview } = useApp()
  const [dialog, setDialog] = useState<DialogKind>(null)
  const [forbidden, setForbidden] = useState(false)
  const current = stockCase.versions[stockCase.versions.length - 1]
  const supported = current.evidenceState === 'supported'
  const canDecide = role === 'manager'

  const run = async (fn: () => Promise<void>, message: string) => {
    try {
      await fn()
      setDialog(null)
      toast.success(message, { description: `${stockCase.id} · ${stockCase.product}` })
    } catch (e) { const message = (e as Error).message; if (message.includes('role cannot')) setForbidden(true); toast.error(message) }
  }

  const disabledReason = !supported
    ? current.evidenceState === 'conflicting'
      ? 'Approval is unavailable: records conflict.'
      : `Approval is unavailable: ${current.unexplained} units are unexplained.`
    : null

  const secondary = [
    { key: 'reject' as const, label: 'Reject', icon: X },
    { key: 'review' as const, label: 'Request review', icon: Eye },
    { key: 'override' as const, label: 'Override with reason', icon: PenLine },
  ].filter((a) => (supported ? true : a.key !== 'override'))

  return (
    <>
      <section
        aria-labelledby="action-panel-title"
        className="hidden flex-col gap-4 rounded-[20px] border border-line bg-surface p-5 lg:flex"
      >
        <h2 id="action-panel-title" className="text-h2 font-semibold">
          Decision
        </h2>
        {forbidden && (
          <ErrorNotice
            title="You don't have permission to approve this case."
            description="Ask a manager to review it. Your role was checked by the server."
          />
        )}
        {!canDecide ? (
          <ReadOnlyNote role={role} />
        ) : (
          <>
            {supported ? (
              <Button size="lg" onClick={() => setDialog('approve')} disabled={forbidden}>
                <Check aria-hidden="true" />
                Approve
              </Button>
            ) : (
              <Button size="lg" onClick={() => setDialog('override')} disabled={forbidden}>
                <PenLine aria-hidden="true" />
                Override with reason
              </Button>
            )}
            {disabledReason && (
              <p className="rounded-[12px] border border-line bg-elevated p-3 text-body-sm text-fg-secondary">
                {disabledReason}
              </p>
            )}
            <div className="flex flex-col gap-2">
              {secondary
                .filter((a) => a.key !== 'override')
                .map((a) => (
                  <Button key={a.key} variant="secondary" onClick={() => setDialog(a.key)} disabled={forbidden}>
                    <a.icon aria-hidden="true" />
                    {a.label}
                  </Button>
                ))}
              {supported && (
                <Button variant="ghost" onClick={() => setDialog('override')} disabled={forbidden}>
                  <PenLine aria-hidden="true" />
                  Override with reason
                </Button>
              )}
            </div>
          </>
        )}
      </section>

      {/* Mobile: fixed bar above the tab bar */}
      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        {forbidden && (
          <ErrorNotice className="mb-3" title="You don't have permission to approve this case." />
        )}
        {!canDecide ? (
          <ReadOnlyNote role={role} compact />
        ) : (
          <div className="flex items-center gap-2">
            <Button
              size="lg"
              className="flex-1"
              disabled={forbidden}
              onClick={() => setDialog(supported ? 'approve' : 'override')}
            >
              {supported ? <Check aria-hidden="true" /> : <PenLine aria-hidden="true" />}
              {supported ? 'Approve' : 'Override with reason'}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="secondary" size="icon-lg" aria-label="More actions" disabled={forbidden} />}
              >
                <MoreHorizontal aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-56 rounded-[12px] border border-line p-1">
                {secondary.map((a) => (
                    <DropdownMenuItem key={a.key} className="min-h-11 text-body-sm" onClick={() => setDialog(a.key)}>
                      <a.icon aria-hidden="true" />
                      {a.label}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
        {canDecide && disabledReason && (
          <p className="mt-2 text-caption text-fg-secondary">{disabledReason}</p>
        )}
      </div>

      <ImpactPreviewDialog
        open={dialog === 'approve'}
        onOpenChange={(o) => !o && setDialog(null)}
        impact={current.impact}
        onConfirm={() => run(() => decide(stockCase.id, 'approved', 'Evidence fully supports the correction.'), 'Correction approved. Stock updated.')}
      />
      <ReasonDialog
        open={dialog === 'reject'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Reject this correction?"
        description="Stock will stay unchanged. Explain why so the team understands the decision."
        confirmLabel="Reject correction"
        onConfirm={(reason) => run(() => decide(stockCase.id, 'rejected', reason), 'Correction rejected. Stock unchanged.')}
      />
      <ReasonDialog
        open={dialog === 'review'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Request review"
        description="The case goes back for more evidence. Say what is missing."
        confirmLabel="Request review"
        onConfirm={(reason) => run(() => requestReview(stockCase.id, reason), 'Review requested.')}
      />
      <ReasonDialog
        open={dialog === 'override'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Override the recommendation?"
        description={`Stock will be set to the counted ${stockCase.counted} even though evidence is not complete.`}
        confirmLabel="Confirm override"
        onConfirm={(reason) => run(() => decide(stockCase.id, 'overridden', reason), 'Override saved. Stock updated.')}
      />
    </>
  )
}

function ReadOnlyNote({ role, compact = false }: { role: string; compact?: boolean }) {
  const text =
    role === 'owner'
      ? 'Owners have read-only access. Managers make decisions.'
      : 'Only managers can approve. Your count has been sent for review.'
  return <p className={compact ? 'text-body-sm text-fg-secondary' : 'rounded-[12px] border border-line bg-elevated p-3 text-body-sm text-fg-secondary'}>{text}</p>
}
