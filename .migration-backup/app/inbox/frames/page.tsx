import type { Metadata } from 'next'
import { InboxFramesView } from '@/components/screens/inbox-frames-view'

export const metadata: Metadata = { title: 'Inbox frames · Veracity' }

export default function InboxFramesPage() {
  return <InboxFramesView />
}
