import type { Role } from './types'

/** Home is a responsibility-specific entry point, not a permission hierarchy. */
export function roleHome(role: Role): string {
  return { staff: '/work', manager: '/inbox', owner: '/reports' }[role]
}

/** Only known in-app destinations may survive the demo entry redirect. */
export function demoDestination(role: Role, next: string | null): string {
  return next && /^\/(?:work|inbox(?:\/frames)?|count|account|history(?:\/[A-Za-z0-9_-]+)?|cases\/[A-Za-z0-9_-]+|reports|decisions)(?:\?[^#\\]*)?$/.test(next)
    ? next : roleHome(role)
}
