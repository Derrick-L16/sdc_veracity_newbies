import { useState } from 'react'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { useApp } from '@/components/app/app-provider'
import { Button } from '@/components/ui/button'
import { Card, ErrorNotice, LockNote } from '@/components/veracity/primitives'
import { ROLE_INFO } from '@/lib/data'
import type { Role } from '@/lib/types'

const ROLES: Role[] = ['staff', 'manager', 'owner']

export function DemoLoginView() {
  const { login } = useApp()
  const [role, setRole] = useState<Role | ''>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  const showValidation = touched && !role

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setTouched(true)
    if (!role || submitting) return
    setError(null)
    setSubmitting(true)
    try {
      await login(role)
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'The demo session could not be started.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-base px-4 py-10">
      <div className="flex w-full max-w-[440px] flex-col gap-6">
        <header className="flex flex-col gap-2">
          <span className="text-caption font-medium tracking-[0.12em] text-accent-text uppercase">Veracity</span>
          <h1 className="text-h1-sm font-semibold text-balance md:text-h1">Enter the demo workspace</h1>
          <p className="text-body text-fg-secondary text-pretty">
            Counts become explainable decisions. Pick a role to see the workspace from that seat.
          </p>
        </header>

        <Card>
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="demo-role" className="text-body-sm font-medium text-fg">
                Role
              </label>
              <select
                id="demo-role"
                data-testid="select-demo-role"
                value={role}
                required
                disabled={submitting}
                aria-invalid={showValidation || undefined}
                aria-describedby={showValidation ? 'demo-role-error' : role ? 'demo-role-desc' : undefined}
                onChange={(e) => {
                  setRole(e.target.value as Role | '')
                  setError(null)
                }}
                onBlur={() => setTouched(true)}
                className="h-11 w-full rounded-[12px] border border-line bg-elevated px-3 text-fg transition-colors hover:border-fg-tertiary disabled:opacity-50 aria-invalid:border-danger"
              >
                <option value="" disabled>
                  Choose a role
                </option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_INFO[r].label}
                  </option>
                ))}
              </select>
              {showValidation ? (
                <p id="demo-role-error" className="text-body-sm text-danger">
                  Choose a role to continue.
                </p>
              ) : role ? (
                <p id="demo-role-desc" aria-live="polite" className="text-body-sm text-fg-secondary">
                  {ROLE_INFO[role].description}
                </p>
              ) : null}
            </div>

            <ul className="flex flex-col gap-2 border-t border-line pt-4" aria-label="Role summaries">
              {ROLES.map((r) => (
                <li key={r} className={`flex gap-3 text-body-sm ${role === r ? 'text-fg' : 'text-fg-secondary'}`}>
                  <span className={`w-16 shrink-0 font-medium ${role === r ? 'text-accent-text' : 'text-fg'}`}>
                    {ROLE_INFO[r].label}
                  </span>
                  <span>{ROLE_INFO[r].description}</span>
                </li>
              ))}
            </ul>

            {error && <ErrorNotice title="Could not enter demo" description={error} />}

            <Button type="submit" size="lg" data-testid="button-enter-demo" disabled={submitting} className="w-full">
              {submitting ? 'Entering demo' : 'Enter demo'}
              {!submitting && <ArrowRight aria-hidden="true" />}
            </Button>
          </form>
        </Card>

        <LockNote>
          <span className="flex items-center gap-2 font-medium text-fg">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Demo access only
          </span>
          <span className="mt-1 block">
            No account required. This is not a real sign-in; data is shared sample inventory.
          </span>
        </LockNote>
      </div>
    </main>
  )
}
