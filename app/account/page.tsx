import type { Metadata } from 'next'
import { AccountView } from '@/components/screens/account-view'

export const metadata: Metadata = { title: 'Account · Veracity' }

export default function AccountPage() {
  return <AccountView />
}
