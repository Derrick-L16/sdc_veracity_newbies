import type { Metadata } from 'next'
import { PassportView } from '@/components/screens/passport-view'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  return { title: `Decision Passport ${id} · Veracity` }
}

export default async function PassportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PassportView id={id} />
}
