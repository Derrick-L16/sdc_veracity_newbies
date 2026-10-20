import type { CaseStatus, Role, StockCase, User } from './types'

export const USERS: Record<Role, User> = {
  staff: { id: 'u-staff-a', name: 'Staff A', role: 'staff' },
  manager: { id: 'u-manager-k', name: 'Manager K', role: 'manager' },
  owner: { id: 'u-owner-r', name: 'Owner R', role: 'owner' },
}

export const ROLE_INFO: Record<Role, { label: string; description: string }> = {
  staff: { label: 'Staff', description: 'Counts stock and submits cases. Cannot approve.' },
  manager: { label: 'Manager', description: 'Approves, rejects, requests review or overrides.' },
  owner: { label: 'Owner', description: 'Read-only access to cases and history.' },
}

export const OPEN_STATUSES: CaseStatus[] = ['pending_approval', 'manual_review', 'needs_review']
export const CLOSED_STATUSES: CaseStatus[] = ['completed', 'rejected']

const STATUS_PRIORITY: Record<CaseStatus, number> = {
  pending_approval: 0,
  manual_review: 1,
  needs_review: 2,
  completed: 3,
  rejected: 4,
}

export function sortInbox(cases: StockCase[]) {
  return [...cases].sort(
    (a, b) =>
      STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status] ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}
