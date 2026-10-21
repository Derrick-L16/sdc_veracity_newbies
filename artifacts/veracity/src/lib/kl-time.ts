const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const KL_OFFSET_MS = 8 * 60 * 60 * 1000 // Asia/Kuala_Lumpur is UTC+8 with no DST

function instant(iso: string): number | null {
  // The backend emits timezone-aware ISO timestamps. Never guess a timezone
  // for malformed legacy data, or use the viewer's browser timezone.
  if (!/([zZ]|[+-]\d{2}:?\d{2})$/.test(iso)) return null
  const value = Date.parse(iso)
  return Number.isNaN(value) ? null : value
}

/** Returns KL wall-clock parts from the backend's timezone-aware timestamps. */
export function klParts(iso: string): { y: number; m: number; d: number; hh: number; mm: number } | null {
  const t = instant(iso)
  if (t === null) return null
  const k = new Date(t + KL_OFFSET_MS)
  return { y: k.getUTCFullYear(), m: k.getUTCMonth() + 1, d: k.getUTCDate(), hh: k.getUTCHours(), mm: k.getUTCMinutes() }
}

export function klDateKey(iso: string): string | null {
  const p = klParts(iso)
  if (!p) return null
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`
}

export function klSortValue(iso: string): number {
  return instant(iso) ?? 0
}

export function formatKl(iso: string): string {
  const p = klParts(iso)
  if (!p) return 'Unknown time'
  return `${p.d} ${MONTHS[p.m - 1]} ${p.y}, ${String(p.hh).padStart(2, '0')}:${String(p.mm).padStart(2, '0')} MYT`
}

export function isValidDateKey(v: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const [y, m, d] = v.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}
