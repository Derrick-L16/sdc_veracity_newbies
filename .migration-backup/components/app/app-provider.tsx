'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { OPEN_STATUSES, USERS } from '@/lib/data'
import type { Decision, Product, Role, StockCase, User } from '@/lib/types'
import type { StockSummary, StaffProgress } from '@/lib/stock'

const EMPTY_SUMMARY: StockSummary = { total: 0, counts: { verified: 0, awaiting: 0, attention: 0, not_counted: 0 }, lastCount: null, missing: { units: 0, value: 0, explained: 0, unexplained: 0, items: [] } }
const EMPTY_PROGRESS: StaffProgress = { total: 0, counted: 0, matched: 0, differ: 0, lastSubmitted: null }
interface Snapshot { user: User; cases: StockCase[]; products: Product[]; summary: StockSummary; progress: StaffProgress }
interface AppState {
  role: Role; user: User; setRole: (role: Role) => void
  cases: StockCase[]; products: Product[]; summary: StockSummary; progress: StaffProgress
  loading: boolean; error: string | null; refresh: () => Promise<void>
  inboxCases: StockCase[]; getCase: (id: string) => StockCase | undefined
  decide: (id: string, action: Decision['action'], reason: string) => Promise<void>
  requestReview: (id: string, reason: string) => Promise<void>
  reassess: (id: string) => Promise<void>
  submitCount: (input: { product: string; recorded: number; counted: number; note: string }) => Promise<StockCase | null>
  findOpenCase: (product: string, counted: number) => StockCase | undefined
}
const AppContext = createContext<AppState | null>(null)
async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/backend/${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Request failed.')
  return data
}
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot>({ user: USERS.manager, cases: [], products: [], summary: EMPTY_SUMMARY, progress: EMPTY_PROGRESS })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const generation = useRef(0)
  const switching = useRef(false)
  const refresh = useCallback(async () => {
    const epoch = generation.current
    try { const data = await api<Snapshot>('state'); if (epoch === generation.current) { setSnapshot(data); setError(null) } }
    catch (e) { if (epoch === generation.current) setError((e as Error).message); throw e }
  }, [])
  useEffect(() => {
    let active = true
    const init = async () => {
      try {
        try { await refresh() } catch { await api('session', { role: 'manager' }); if (active) await refresh() }
      } catch (e) { if (active) setError((e as Error).message) }
      finally { if (active) setLoading(false) }
    }
    void init()
    const timer = setInterval(() => { if (!switching.current) void refresh().catch(() => {}) }, 10000)
    return () => { active = false; clearInterval(timer) }
  }, [refresh])
  const setRole = useCallback((role: Role) => {
    if (switching.current) return
    switching.current = true; generation.current++; setLoading(true)
    void (async () => {
      try { await api('session', { role }); await refresh() }
      catch (e) { toast.error((e as Error).message) }
      finally { switching.current = false; setLoading(false) }
    })()
  }, [refresh])
  const { cases, products, user, summary, progress } = snapshot
  const role = user.role
  const getCase = useCallback((id: string) => cases.find(c => c.id === id), [cases])
  const mutate = useCallback(async (path: string, body: unknown) => {
    try { const result = await api<StockCase>(path, body); await refresh(); return result }
    catch (e) { void refresh().catch(() => {}); throw e }
  }, [refresh])
  const decide = useCallback(async (id: string, action: Decision['action'], reason: string) => { await mutate(`cases/${id}/decisions`, { action, reason, version: getCase(id)?.versions.at(-1)?.version }) }, [mutate, getCase])
  const requestReview = useCallback(async (id: string, reason: string) => { await mutate(`cases/${id}/decisions`, { action: 'review', reason, version: getCase(id)?.versions.at(-1)?.version }) }, [mutate, getCase])
  const reassess = useCallback(async (id: string) => { await mutate(`cases/${id}/reassess`, {}) }, [mutate])
  const submitCount = useCallback(async (input: { product: string; recorded: number; counted: number; note: string }) => {
    const result = await api<StockCase | { matched: true }>('counts', input); await refresh(); return 'matched' in result ? null : result
  }, [refresh])
  const findOpenCase = useCallback((product: string, _counted: number) => cases.find(c => c.product === product && OPEN_STATUSES.includes(c.status)), [cases])
  const inboxCases = useMemo(() => cases.filter(c => OPEN_STATUSES.includes(c.status)), [cases])
  return <AppContext.Provider value={{ role, user, setRole, cases, products, summary, progress, loading, error, refresh, inboxCases, getCase, decide, requestReview, reassess, submitCount, findOpenCase }}>{children}</AppContext.Provider>
}
export function useApp() { const ctx = useContext(AppContext); if (!ctx) throw new Error('useApp must be used inside AppProvider'); return ctx }
