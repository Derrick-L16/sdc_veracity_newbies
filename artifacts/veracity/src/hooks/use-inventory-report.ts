import { useCallback, useEffect, useRef, useState } from 'react'
import { getInventorySummaryReport, type InventorySummaryReport } from '@workspace/api-client-react'
import type { ReportPeriod } from '@/lib/report-period'

interface State {
  key: string
  report: InventorySummaryReport | null
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
  return 'The summary could not be loaded.'
}

/**
 * date: normalized period start (YYYY-MM-DD) or null for the live current period.
 * scope: role etc. Changing it discards report data immediately.
 */
export function useInventoryReport(period: ReportPeriod, date: string | null, enabled: boolean, scope: string) {
  const key = `${scope}|${period}|${date ?? 'current'}|${enabled ? 1 : 0}`
  const blank = (k: string): State => ({ key: k, report: null, error: null, refreshError: null, loading: enabled, refreshing: false })
  const [state, setState] = useState<State>(() => blank(key))
  const reqId = useRef(0)
  const ctrl = useRef<AbortController | null>(null)
  const keyRef = useRef(key)
  keyRef.current = key

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
      const params = date ? { period, date } : { period }
      const report = await getInventorySummaryReport(params, { signal: ac.signal, cache: 'no-store', credentials: 'include' })
      if (id !== reqId.current || keyRef.current !== k) return
      if (report.period !== period) throw new Error(`Server returned a ${report.period} report instead of ${period}.`)
      if (date && report.periodStart.slice(0, 10) !== date) throw new Error(`Server returned the period starting ${report.periodStart} instead of ${date}.`)
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
  }, [enabled, period, date])

  useEffect(() => {
    if (!enabled) { ctrl.current?.abort(); return }
    void load('initial')
    let timer: ReturnType<typeof setInterval> | undefined
    if (date === null) timer = setInterval(() => { if (document.visibilityState !== 'hidden') void load('refresh') }, 30000)
    return () => { if (timer) clearInterval(timer); ctrl.current?.abort(); reqId.current++ }
  }, [enabled, date, load, scope])

  const retry = useCallback(() => { void load(view.report ? 'refresh' : 'initial') }, [load, view.report])
  return { ...view, loading: enabled && (view.loading || (!view.report && !view.error)), retry, isCurrent: date === null }
}
