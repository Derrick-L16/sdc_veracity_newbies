'use client'

import { ChevronDown, UserCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ROLE_INFO } from '@/lib/data'
import type { Role } from '@/lib/types'
import { useApp } from './app-provider'

export function RoleSwitcher() {
  const { role, setRole, user } = useApp()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="secondary" aria-label={`Role: ${ROLE_INFO[role].label}. Change role`} />}>
        <UserCircle2 aria-hidden="true" />
        <span className="hidden sm:inline">{user.name}</span>
        <span className="text-fg-secondary">{ROLE_INFO[role].label}</span>
        <ChevronDown className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 rounded-[12px] border border-line p-1">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-3 py-2 text-caption font-medium tracking-[0.04em] text-fg-secondary uppercase">
            Preview as role
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup value={role} onValueChange={(v) => setRole(v as Role)}>
            {(Object.keys(ROLE_INFO) as Role[]).map((r) => (
              <DropdownMenuRadioItem key={r} value={r} className="min-h-11 items-start px-3 py-2">
                <span className="flex flex-col gap-0.5">
                  <span className="text-body-sm font-medium">{ROLE_INFO[r].label}</span>
                  <span className="text-caption text-fg-secondary">{ROLE_INFO[r].description}</span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
