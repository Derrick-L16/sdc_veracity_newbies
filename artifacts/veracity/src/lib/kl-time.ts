const KL_OFFSET_MS = 8 * 60 * 60 * 1000 // Asia/Kuala_Lumpur is UTC+8 with no DST
const pad = (n: number) => String(n).padStart(2, '0')

function instant(iso: string): number | null {
  // The backend emits timezone-aware ISO timestamps. Never guess a timezone
  // for malformed legacy data, or use the viewer's browser timezone.
  if (!/([zZ]|[+-]\d{2}:?\d{2})$/.test(iso)) return null
  const value = Date.parse(iso)
  return Number.isNaN(value) ? null : value
}

/** Returns KL wall-clock parts from the backend's timezone-aware timestamps. */
export function klParts(iso: string): { y: number; m: number; d: number; hh: number; mm: number; ss: number } | null {
  const t = instant(iso)
  if (t === null) return null
  const k = new Date(t + KL_OFFSET_MS)
  return { y: k.getUTCFullYear(), m: k.getUTCMonth() + 1, d: k.getUTCDate(), hh: k.getUTCHours(), mm: k.getUTCMinutes(), ss: k.getUTCSeconds() }
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
  return `${pad(p.d)}/${pad(p.m)}/${p.y} ${pad(p.hh)}:${pad(p.mm)}:${pad(p.ss)}`
}

/** Calendar dates are not instants: never apply an offset to a weekly date key. */
export function formatCalendarDate(key: string): string {
  if (!isValidDateKey(key)) return ''
  const [y, m, d] = key.split('-')
  return `${d}/${m}/${y}`
}

export function isValidDateKey(v: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const [y, m, d] = v.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}
