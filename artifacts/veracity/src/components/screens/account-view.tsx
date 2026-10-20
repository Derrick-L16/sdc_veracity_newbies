
import { DataImport } from '@/components/veracity/data-import'
import { Check } from 'lucide-react'
import { useApp } from '@/components/app/app-provider'
import { Card, PageHeader } from '@/components/veracity/primitives'
import { ROLE_INFO, USERS } from '@/lib/data'
import type { Role } from '@/lib/types'
import { cn } from '@/lib/utils'

const ROLES: Role[] = ['staff', 'manager', 'owner']

export function AccountView() {
  const { user, role, setRole } = useApp()

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader title="Account" subtitle="Signed in as a demo user. Switch roles to see each permission level." />

      <Card className="flex items-center gap-4 p-5">
        <span
          aria-hidden="true"
          className="flex size-12 items-center justify-center rounded-full bg-accent-fill text-h3 font-semibold text-white"
        >
          {user.name.split(' ').map((p) => p[0]).join('')}
        </span>
        <div className="flex flex-col">
          <span className="text-h3 font-semibold">{user.name}</span>
          <span className="text-body-sm text-fg-secondary">{ROLE_INFO[role].label}</span>
        </div>
      </Card>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-h3 font-semibold">Role</legend>
        {ROLES.map((r) => {
          const active = r === role
          return (
            <label
              key={r}
              className={cn(
                'flex min-h-11 cursor-pointer items-center gap-4 rounded-[20px] border bg-surface p-4 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-accent-text',
                active ? 'border-accent-text' : 'border-line hover:border-fg-tertiary',
              )}
            >
              <input type="radio" name="role" value={r} checked={active} onChange={() => setRole(r)} className="sr-only" />
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="text-body font-semibold">
                  {ROLE_INFO[r].label} <span className="font-normal text-fg-tertiary">· {USERS[r].name}</span>
                </span>
                <span className="text-body-sm text-fg-secondary">{ROLE_INFO[r].description}</span>
              </div>
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-6 items-center justify-center rounded-full border',
                  active ? 'border-accent-fill bg-accent-fill text-white' : 'border-line',
                )}
              >
                {active && <Check className="size-4" />}
              </span>
            </label>
          )
        })}
      </fieldset>
      <DataImport />
    </div>
  )
}
