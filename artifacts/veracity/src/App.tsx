import { useEffect } from 'react'
import { Redirect, Route, Router, Switch, useLocation, useSearch } from 'wouter'
import { ThemeProvider } from 'next-themes'
import { AppProvider } from '@/components/app/app-provider'
import { AppShell } from '@/components/app/app-shell'
import { Toaster } from '@/components/ui/sonner'
import { AccountView } from '@/components/screens/account-view'
import { CountView } from '@/components/screens/count-view'
import { HistoryView } from '@/components/screens/history-view'
import { InboxView } from '@/components/screens/inbox-view'
import { CaseDetailView } from '@/components/screens/case-detail-view'
import { PassportView } from '@/components/screens/passport-view'
import { ErrorBoundary } from '@/components/error-boundary'

function Pages() {
  const [location] = useLocation()
  const search = useSearch()
  useEffect(() => {
    const titles: Record<string, string> = {
      '/count': 'New count', '/inbox': 'Inbox', '/inbox/frames': 'Inbox frames',
      '/history': 'History', '/account': 'Account',
    }
    const id = location.split('/').at(-1)
    document.title = `${titles[location] ?? (location.startsWith('/history/') ? `Decision Passport ${id}` : location.startsWith('/cases/') ? id : 'Page not found')} · Veracity`
  }, [location])
  useEffect(() => { window.scrollTo(0, 0) }, [location])
  return (
    <ErrorBoundary resetKey={location}>
      <Switch>
        <Route path="/"><Redirect to="/inbox" /></Route>
        <Route path="/inbox" component={InboxView} />
        <Route path="/inbox/frames" component={InboxView} />
        <Route path="/count" component={CountView} />
        <Route path="/history" component={HistoryView} />
        <Route path="/account" component={AccountView} />
        <Route path="/cases/:id">{({ id }) => {
          const version = new URLSearchParams(search).get('v')
          return <CaseDetailView id={id} version={version ? Number(version) : undefined} />
        }}</Route>
        <Route path="/history/:id">{({ id }) => <PassportView id={id} />}</Route>
        <Route><h1 className="text-h1 font-semibold">Page not found</h1><a href="/inbox">Return to Inbox</a></Route>
      </Switch>
    </ErrorBoundary>
  )
}

export default function App() {
  return (
    <Router base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
        <AppProvider>
          <AppShell><Pages /></AppShell>
          <Toaster position="top-center" />
        </AppProvider>
      </ThemeProvider>
    </Router>
  )
}
