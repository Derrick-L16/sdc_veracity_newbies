import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export function StaleBanner({ href }: { href: string }) {
  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-[12px] border border-warning/50 bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="flex items-start gap-2 text-body-sm text-fg">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
        <span>New evidence was added. This recommendation is out of date.</span>
      </p>
      <Link
        href={href}
        className="inline-flex min-h-11 items-center text-body-sm font-medium text-accent-text underline-offset-4 hover:underline"
      >
        View latest version
      </Link>
    </div>
  )
}

export function Block({ className }: { className?: string }) {
  return <Skeleton className={cn('rounded-[12px] bg-elevated', className)} />
}

export function CaseDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading case">
      <span className="sr-only">Loading case…</span>
      <Block className="h-11 w-64" />
      <Block className="h-8 w-full max-w-lg" />
      <div className="grid gap-6 lg:grid-cols-[65fr_35fr]">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Block className="h-28" />
            <Block className="h-28" />
          </div>
          <Block className="h-24" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Block key={i} className="h-28 rounded-[20px]" />
          ))}
        </div>
        <Block className="h-72 rounded-[20px]" />
      </div>
    </div>
  )
}
