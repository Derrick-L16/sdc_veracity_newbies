import type { Metadata } from 'next'
import { CountView } from '@/components/screens/count-view'

export const metadata: Metadata = { title: 'New count · Veracity' }

export default function CountPage() {
  return <CountView />
}
