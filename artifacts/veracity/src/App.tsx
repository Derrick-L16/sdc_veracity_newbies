import { useEffect, type ReactNode } from 'react'
import { ThemeProvider } from 'next-themes'
import { Redirect, Route, Switch, useLocation, useParams, useSearch, Router as WouterRouter } from 'wouter'
import { ErrorBoundary } from '@/components/error-boundary'
import { AppProvider } from '@/components/app/app-provider'
import { AppShell } from '@/components/app/app-shell'
import { Toaster } from '@/components/ui/sonner'
import { AccountView } from '@/components/screens/account-view'
import { CaseDetailView } from '@/components/screens/case-detail-view'
import { CountView } from '@/components/screens/count-view'
import { HistoryView } from '@/components/screens/history-view'
import { InboxFramesView } from '@/components/screens/inbox-frames-view'
import { InboxView } from '@/components/screens/inbox-view'
import { PassportView } from '@/components/screens/passport-view'

function useTitle(title: string) {
  useEffect(() => {
    document.title = title
  }, [title])
}

function Titled({ title, children }: { title: string; children: ReactNode }) {
  useTitle(title)
  return <>{children}</>
}

function CasePage() {
  const { id = '' } = useParams<{ id: string }>()
  const v = new URLSearchParams(useSearch()).get('v')
  useTitle(`${id} · Veracity`)
  return <CaseDetailView id={id} version={v ? Number(v) : undefined} />
}

function PassportPage() {
  const { id = '' } = useParams<{ id: string }>()
  useTitle(`Decision Passport ${id} · Veracity`)
  return <PassportView id={id} />
}

function Router() {
  const [location] = useLocation()
  return (
    <ErrorBoundary resetKey={location}>
      <Switch>
        <Route path="/"><Redirect to="/inbox" replace /></Route>
        <Route path="/inbox"><Titled title="Inbox · Veracity"><InboxView /></Titled></Route>
        <Route path="/inbox/frames"><Titled title="Inbox frames · Veracity"><InboxFramesView /></Titled></Route>
        <Route path="/count"><Titled title="New count · Veracity"><CountView /></Titled></Route>
        <Route path="/account"><Titled title="Account · Veracity"><AccountView /></Titled></Route>
        <Route path="/cases/:id" component={CasePage} />
        <Route path="/history"><Titled title="History · Veracity"><HistoryView /></Titled></Route>
        <Route path="/history/:id" component={PassportPage} />
        <Route>
          <Titled title="Page not found · Veracity">
            <div className="flex min-h-80 flex-col items-center justify-center gap-4">
              <h1 className="text-h1 font-semibold">404 · Page not found</h1>
              <a href={`${import.meta.env.BASE_URL}inbox`} className="text-accent-text underline">Back to Inbox</a>
            </div>
          </Titled>
        </Route>
      </Switch>
    </ErrorBoundary>
  )
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <AppProvider>
          <AppShell>
            <Router />
          </AppShell>
          <Toaster position="top-center" />
        </AppProvider>
      </WouterRouter>
    </ThemeProvider>
  )
}

export default App
