import type { Metadata } from 'next'
import { HistoryView } from '@/components/screens/history-view'

export const metadata: Metadata = { title: 'History · Veracity' }

export default function HistoryPage() {
  return <HistoryView />
}
