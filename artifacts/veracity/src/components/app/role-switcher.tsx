
import { ChevronDown, UserCircle2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ROLE_INFO } from '@/lib/data'
import { useApp } from './app-provider'

export function RoleSwitcher() {
  const { role, changeRole } = useApp()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const leave = async () => {
    setOpen(false); setBusy(true)
    try { await changeRole() }
    catch (e) { toast.error((e as Error).message) }
    finally { setBusy(false) }
  }
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger render={<Button variant="secondary" disabled={busy} aria-label={`Role: ${ROLE_INFO[role].label}. Change role`} />}>
        <UserCircle2 aria-hidden="true" />
        <span className="text-fg-secondary">{ROLE_INFO[role].label}</span>
        <ChevronDown className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 rounded-[12px] border border-line p-1">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => { void leave() }} className="min-h-11 cursor-pointer px-3 py-2 text-fg transition-colors hover:bg-accent-fill/20 hover:text-fg focus:bg-accent-fill/20 focus:text-fg data-highlighted:bg-accent-fill/20 data-highlighted:text-fg" data-testid="button-change-role">
            Change role
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
