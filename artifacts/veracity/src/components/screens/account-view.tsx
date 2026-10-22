
import { DataImport } from '@/components/veracity/data-import'
import { useApp } from '@/components/app/app-provider'
import { Card, PageHeader } from '@/components/veracity/primitives'
import { ROLE_INFO } from '@/lib/data'

export function AccountView() {
  const { user, role } = useApp()

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader title="Account" subtitle="Your current demo identity. Use Change role in the top-right menu to return to role selection." />

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

      <Card className="p-5">
        <h2 className="text-h3 font-semibold">{ROLE_INFO[role].label} access</h2>
        <p className="mt-2 text-body-sm text-fg-secondary">{ROLE_INFO[role].description}</p>
        <p className="mt-3 text-caption text-fg-tertiary">Demo access only. No email, password or real account is used.</p>
      </Card>
      <DataImport />
    </div>
  )
}
