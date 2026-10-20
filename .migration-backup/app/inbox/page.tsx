import type { Metadata } from 'next'
import { InboxView } from '@/components/screens/inbox-view'

export const metadata: Metadata = { title: 'Inbox · Veracity' }

export default function InboxPage() {
  return <InboxView />
}
