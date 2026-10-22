import { useCallback, useEffect, useRef, useState } from 'react'
import { getWeeklyInventoryReport, type WeeklyInventoryReport } from '@workspace/api-client-react'

export const REPORT_TZ = 'Asia/Kuala_Lumpur'
const KL_OFFSET_MS = 8 * 60 * 60 * 1000
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Today's calendar date in Kuala Lumpur (UTC+8, no DST) as YYYY-MM-DD. */
export function todayKL(now = Date.now()): string {
  return new Date(now + KL_OFFSET_MS).toISOString().slice(0, 10)
}

function parseISODate(value: string): Date | null {
  if (!DATE_RE.test(value)) return null
  const d = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : d
}

export function mondayOf(value: string): string | null {
  const d = parseISODate(value)
  if (!d) return null
  const dow = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}

export function shiftWeek(monday: string, weeks: number): string {
  const d = parseISODate(monday)!
  d.setUTCDate(d.getUTCDate() + weeks * 7)
  return d.toISOString().slice(0, 10)
}

export function currentMondayKL(): string {
  return mondayOf(todayKL())!
}

/** Normalizes any date to its KL Monday; returns null for invalid or future dates. */
export function normalizeWeek(value: string | null | undefined): { week: string | null; error: string | null } {
  if (!value) return { week: null, error: null }
  const monday = mondayOf(value)
  if (!monday) return { week: null, error: 'That date is not valid. Showing the current week.' }
  if (monday < '2000-01-03') return { week: null, error: 'Reports start from the first Monday of 2000. Showing the current week.' }
  if (value > todayKL()) return { week: null, error: 'Future dates have no report. Showing the current week.' }
  return { week: monday === currentMondayKL() ? null : monday, error: null }
}

interface State {
  key: string
  report: WeeklyInventoryReport | null
  error: string | null
  refreshError: string | null
  loading: boolean
  refreshing: boolean
}

function message(e: unknown): string {
  if (e && typeof e === 'object') {
    const data = (e as { data?: { error?: unknown } }).data
    if (data && typeof data.error === 'string') return data.error
    if ('message' in e && typeof (e as Error).message === 'string' && (e as Error).message) return (e as Error).message
  }
  return 'The weekly report could not be loaded.'
}

/**
 * week: Monday YYYY-MM-DD, or null for the live current week.
 * scope: changes (e.g. role) discard all report data immediately.
 */
export function useWeeklyReport(week: string | null, enabled: boolean, scope: string) {
  const key = `${scope}|${week ?? 'current'}|${enabled ? 1 : 0}`
  const blank = (k: string): State => ({ key: k, report: null, error: null, refreshError: null, loading: enabled, refreshing: false })
  const [state, setState] = useState<State>(() => blank(key))
  const reqId = useRef(0)
  const ctrl = useRef<AbortController | null>(null)
  const keyRef = useRef(key)
  keyRef.current = key

  // Clear synchronously during render when scope/week changes so stale data never shows under a new label.
  const view = state.key === key ? state : blank(key)
  if (state.key !== key) setState(view)

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (!enabled) return
    ctrl.current?.abort()
    const ac = new AbortController()
    ctrl.current = ac
    const id = ++reqId.current
    const k = keyRef.current
    setState((s) => (s.key !== k ? s : mode === 'initial' ? { ...s, loading: true, error: null } : { ...s, refreshing: true }))
    try {
      const report = await getWeeklyInventoryReport(week ? { week } : undefined, { signal: ac.signal, cache: 'no-store', credentials: 'include' })
      if (id !== reqId.current || keyRef.current !== k) return
      if (week && report.weekStart !== week) throw new Error(`Server returned week ${report.weekStart} instead of ${week}.`)
      setState({ key: k, report, error: null, refreshError: null, loading: false, refreshing: false })
    } catch (e) {
      if (ac.signal.aborted || id !== reqId.current || keyRef.current !== k) return
      const msg = message(e)
      setState((s) => {
        if (s.key !== k) return s
        if (s.report && mode === 'refresh') return { ...s, refreshError: msg, refreshing: false }
        return { ...s, report: null, error: msg, loading: false, refreshing: false }
      })
    }
  }, [enabled, week])

  useEffect(() => {
    if (!enabled) { ctrl.current?.abort(); return }
    void load('initial')
    let timer: ReturnType<typeof setInterval> | undefined
    if (week === null) timer = setInterval(() => { if (document.visibilityState !== 'hidden') void load('refresh') }, 30000)
    return () => { if (timer) clearInterval(timer); ctrl.current?.abort(); reqId.current++ }
  }, [enabled, week, load, scope])

  const isCurrent = week === null
  const retry = useCallback(() => { void load(view.report ? 'refresh' : 'initial') }, [load, view.report])
  return { ...view, loading: enabled && (view.loading || (!view.report && !view.error)), retry, isCurrent }
}
