
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'wouter'
import { demoDestination } from '@/lib/role-home'
import { OPEN_STATUSES, USERS } from '@/lib/data'
import type { Decision, DecisionGuard, Product, Role, StockCase, User } from '@/lib/types'
import type { StockSummary, StaffProgress } from '@/lib/stock'
import { createInventoryProduct, type ProductInput } from '@workspace/api-client-react'

const EMPTY_SUMMARY: StockSummary = { total: 0, counts: { verified: 0, awaiting: 0, attention: 0, not_counted: 0 }, matches: 0, items: [], updatedAt: '', lastCount: null, missing: { units: 0, value: 0, explained: 0, unexplained: 0, items: [] } }
const EMPTY_PROGRESS: StaffProgress = { total: 0, counted: 0, matched: 0, differ: 0, lastSubmitted: null }
interface Snapshot { user: User; cases: StockCase[]; products: Product[]; summary: StockSummary; progress: StaffProgress }
interface AppState {
  role: Role; user: User; authenticated: boolean
  login: (role: Role) => Promise<void>; changeRole: () => Promise<void>
  registerUnsavedWork: () => () => void
  cases: StockCase[]; products: Product[]; summary: StockSummary; progress: StaffProgress
  loading: boolean; error: string | null; refresh: () => Promise<void>
  inboxCases: StockCase[]; getCase: (id: string) => StockCase | undefined
  decide: (id: string, action: Decision['action'], reason: string, guard: DecisionGuard) => Promise<void>
  requestReview: (id: string, reason: string, guard: DecisionGuard) => Promise<void>
  reassess: (id: string) => Promise<void>
  createProduct: (input: ProductInput) => Promise<Product>
  submitCount: (input: { product: string; recorded: number; counted: number; note: string }) => Promise<StockCase | null>
  findOpenCase: (product: string, counted: number) => StockCase | undefined
}
const AppContext = createContext<AppState | null>(null)
async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/backend/${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' })
  const data = await response.json()
  if (!response.ok) throw Object.assign(new Error(data.error || 'Request failed.'), { status: response.status })
  return data
}
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [, navigate] = useLocation()
  const [snapshot, setSnapshot] = useState<Snapshot>({ user: USERS.staff, cases: [], products: [], summary: EMPTY_SUMMARY, progress: EMPTY_PROGRESS })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [authenticated, setAuthenticated] = useState(false)
  const signedIn = useRef(false)
  const unsavedWork = useRef(new Set<symbol>())
  const generation = useRef(0)
  const switching = useRef(false)
  const clearIdentity = useCallback(() => {
    signedIn.current = false
    setAuthenticated(false)
    setSnapshot({ user: USERS.staff, cases: [], products: [], summary: EMPTY_SUMMARY, progress: EMPTY_PROGRESS })
    setError(null)
  }, [])
  const registerUnsavedWork = useCallback(() => {
    const key = Symbol()
    unsavedWork.current.add(key)
    return () => { unsavedWork.current.delete(key) }
  }, [])
  const refresh = useCallback(async () => {
    const epoch = generation.current
    try {
      const data = await api<Snapshot>('state')
      if (epoch === generation.current) {
        setSnapshot(data); setError(null); signedIn.current = true; setAuthenticated(true)
      }
    } catch (e) {
      if (epoch === generation.current) {
        if ((e as { status?: number }).status === 401) clearIdentity()
        else setError((e as Error).message)
      }
      throw e
    }
  }, [clearIdentity])
  useEffect(() => {
    let active = true
    const init = async () => {
      try {
        await refresh()
      } catch { /* refresh distinguishes an absent session from a failed service. */ }
      finally { if (active) setLoading(false) }
    }
    void init()
    const timer = setInterval(() => { if (signedIn.current && !switching.current) void refresh().catch(() => {}) }, 10000)
    return () => { active = false; clearInterval(timer) }
  }, [refresh])
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (unsavedWork.current.size) { event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])
  const login = useCallback(async (role: Role) => {
    if (switching.current) return
    switching.current = true; generation.current++; setLoading(true)
    clearIdentity()
    try {
      const session = await api<{ user: User }>('session', { role })
      await refresh()
      const next = new URLSearchParams(window.location.search).get('next')
      navigate(demoDestination(session.user.role, next), { replace: true })
    } finally { switching.current = false; setLoading(false) }
  }, [refresh, navigate, clearIdentity])
  const changeRole = useCallback(async () => {
    if (switching.current) return
    if (unsavedWork.current.size && !window.confirm('Your unsaved work will be discarded. Change role?')) return
    switching.current = true; generation.current++
    try {
      await api('session/end', {})
      clearIdentity()
      navigate('/login', { replace: true })
    } finally { switching.current = false }
  }, [clearIdentity, navigate])
  const { cases, products, user, summary, progress } = snapshot
  const role = user.role
  const getCase = useCallback((id: string) => cases.find(c => c.id === id), [cases])
  const mutate = useCallback(async (path: string, body: unknown) => {
    try { const result = await api<StockCase>(path, body); await refresh(); return result }
    catch (e) { void refresh().catch(() => {}); throw e }
  }, [refresh])
  const decide = useCallback(async (id: string, action: Decision['action'], reason: string, guard: DecisionGuard) => { await mutate(`cases/${id}/decisions`, { action, reason, ...guard }) }, [mutate])
  const requestReview = useCallback(async (id: string, reason: string, guard: DecisionGuard) => { await mutate(`cases/${id}/decisions`, { action: 'review', reason, ...guard }) }, [mutate])
  const reassess = useCallback(async (id: string) => { await mutate(`cases/${id}/reassess`, {}) }, [mutate])
  const createProduct = useCallback(async (input: ProductInput) => {
    const result = await createInventoryProduct(input)
    try { await refresh() } catch { /* The create response is authoritative; refresh exposes its own error state. */ }
    return result
  }, [refresh])
  const submitCount = useCallback(async (input: { product: string; recorded: number; counted: number; note: string }) => {
    const result = await api<StockCase | { matched: true }>('counts', input)
    try { await refresh() } catch { /* The count result is authoritative; refresh exposes its own error state. */ }
    return 'matched' in result ? null : result
  }, [refresh])
  const findOpenCase = useCallback((product: string, _counted: number) => cases.find(c => c.product === product && OPEN_STATUSES.includes(c.status)), [cases])
  const inboxCases = useMemo(() => cases.filter(c => OPEN_STATUSES.includes(c.status)), [cases])
  return <AppContext.Provider value={{ role, user, authenticated, login, changeRole, registerUnsavedWork, cases, products, summary, progress, loading, error, refresh, inboxCases, getCase, decide, requestReview, reassess, createProduct, submitCount, findOpenCase }}>{children}</AppContext.Provider>
}
export function useApp() { const ctx = useContext(AppContext); if (!ctx) throw new Error('useApp must be used inside AppProvider'); return ctx }
export function useUnsavedWork(dirty: boolean) {
  const { registerUnsavedWork } = useApp()
  useEffect(() => dirty ? registerUnsavedWork() : undefined, [dirty, registerUnsavedWork])
}
