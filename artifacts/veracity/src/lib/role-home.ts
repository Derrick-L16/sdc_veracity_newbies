import type { Role } from './types'

/** Home is a responsibility-specific entry point, not a permission hierarchy. */
export function roleHome(role: Role): string {
  return { staff: '/work', manager: '/inbox', owner: '/reports' }[role]
}
