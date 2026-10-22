import { formatCalendarDate, isValidDateKey, klParts } from '@/lib/kl-time'

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly'
export const PERIODS: ReportPeriod[] = ['daily', 'weekly', 'monthly', 'yearly']
export const PERIOD_LABEL: Record<ReportPeriod, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' }
export const PERIOD_NOUN: Record<ReportPeriod, string> = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }
export const MIN_DATE = '2000-01-01'
const KL_OFFSET_MS = 8 * 60 * 60 * 1000
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const todayKL = (now = Date.now()) => new Date(now + KL_OFFSET_MS).toISOString().slice(0, 10)
const toDate = (k: string) => new Date(`${k}T00:00:00Z`)
const key = (d: Date) => d.toISOString().slice(0, 10)

export function isPeriod(v: string | null): v is ReportPeriod {
  return !!v && (PERIODS as string[]).includes(v)
}

/** Calendar start of the period containing `date` (Malaysia calendar). */
export function periodStart(period: ReportPeriod, date: string): string {
  const d = toDate(date)
  if (period === 'weekly') d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  if (period === 'monthly') d.setUTCDate(1)
  if (period === 'yearly') { d.setUTCMonth(0); d.setUTCDate(1) }
  return key(d)
}

export function shiftPeriod(period: ReportPeriod, start: string, n: number): string {
  const d = toDate(start)
  if (period === 'daily') d.setUTCDate(d.getUTCDate() + n)
  if (period === 'weekly') d.setUTCDate(d.getUTCDate() + 7 * n)
  if (period === 'monthly') d.setUTCMonth(d.getUTCMonth() + n)
  if (period === 'yearly') d.setUTCFullYear(d.getUTCFullYear() + n)
  return key(d)
}

export const currentStart = (period: ReportPeriod) => periodStart(period, todayKL())

/** Returns normalized start or null (= current period), plus a notice for rejected input. */
export function normalizeDate(period: ReportPeriod, raw: string | null): { date: string | null; error: string | null } {
  if (!raw) return { date: null, error: null }
  if (!isValidDateKey(raw)) return { date: null, error: `That date is not valid. Showing the current ${PERIOD_NOUN[period]}.` }
  if (raw < MIN_DATE) return { date: null, error: `Reports start from 01/01/2000. Showing the current ${PERIOD_NOUN[period]}.` }
  if (raw > todayKL()) return { date: null, error: `Future dates have no report. Showing the current ${PERIOD_NOUN[period]}.` }
  const s = periodStart(period, raw)
  if (s < MIN_DATE) return { date: null, error: `Choose a period beginning in 2000 or later. Showing the current ${PERIOD_NOUN[period]}.` }
  return { date: s === currentStart(period) ? null : s, error: null }
}

export function periodTitle(period: ReportPeriod, start: string, end: string): string {
  const [y, m] = start.split('-').map(Number)
  if (period === 'daily') return formatCalendarDate(start)
  if (period === 'monthly') return `${MONTHS[m - 1]} ${y}`
  if (period === 'yearly') return String(y)
  return `${formatCalendarDate(start)} to ${formatCalendarDate(end)}`
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Short axis label for a bucket start timestamp. */
export function bucketAxisLabel(period: ReportPeriod, iso: string): string {
  const p = klParts(iso)
  if (!p) return ''
  if (period === 'daily') return pad(p.hh)
  if (period === 'yearly') return MONTHS[p.m - 1]
  if (period === 'weekly') return toDate(`${p.y}-${pad(p.m)}-${pad(p.d)}`).toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short' })
  return String(p.d)
}

/** Full label for the detail panel. */
export function bucketLongLabel(period: ReportPeriod, startIso: string, endIso: string): string {
  const p = klParts(startIso)
  const e = klParts(endIso)
  if (!p) return 'Unknown period'
  const date = `${pad(p.d)}/${pad(p.m)}/${p.y}`
  if (period === 'daily') {
    const end = e ? `${pad(e.hh)}:${pad(e.mm)}` : ''
    return `${date}, ${pad(p.hh)}:00 to ${end === '00:00' ? '24:00' : end}`
  }
  if (period === 'yearly') return `${MONTHS[p.m - 1]} ${p.y}`
  const wd = toDate(`${p.y}-${pad(p.m)}-${pad(p.d)}`).toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'long' })
  return `${wd} ${date}`
}

export const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
