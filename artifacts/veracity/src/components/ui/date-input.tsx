import type { ComponentProps } from 'react'
import { CalendarDays } from 'lucide-react'
import { formatCalendarDate } from '@/lib/kl-time'
import { cn } from '@/lib/utils'

/** Keep native calendar/ISO values, but never let browser locale change the label. */
export function DateInput({
  value,
  className,
  onClick,
  ...props
}: Omit<ComponentProps<'input'>, 'type' | 'value'> & { value: string }) {
  return (
    <div
      className={cn('relative flex items-center gap-2 rounded-full border border-line px-3 text-fg focus-within:ring-2 focus-within:ring-focus data-invalid:border-danger', className)}
      data-invalid={props['aria-invalid'] || undefined}
    >
      <span aria-hidden="true" className="pointer-events-none min-w-0 flex-1 num">
        {formatCalendarDate(value) || 'DD/MM/YYYY'}
      </span>
      <CalendarDays aria-hidden="true" className="pointer-events-none size-4 shrink-0 text-fg-secondary" />
      <input
        {...props}
        type="date"
        value={value}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        onClick={(event) => {
          onClick?.(event)
          if (!event.defaultPrevented) {
            try { event.currentTarget.showPicker() } catch { /* Native keyboard editing still works. */ }
          }
        }}
      />
    </div>
  )
}
