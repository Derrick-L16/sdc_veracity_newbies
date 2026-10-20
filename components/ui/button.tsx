import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[12px] border border-transparent text-body-sm font-medium whitespace-nowrap transition-colors select-none active:not-aria-[haspopup]:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 data-disabled:cursor-not-allowed data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: 'bg-accent-fill text-white hover:bg-accent-fill/85',
        primary: 'bg-accent-fill text-white hover:bg-accent-fill/85',
        secondary: 'border-line bg-elevated text-fg hover:border-fg-tertiary',
        outline: 'border-line bg-transparent text-fg hover:bg-elevated',
        ghost: 'text-fg-secondary hover:bg-elevated hover:text-fg',
        destructive: 'border-line bg-elevated text-danger hover:border-danger',
        link: 'h-auto px-0 text-accent-text underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-4',
        lg: 'h-12 px-5 text-body-sm',
        sm: 'h-11 px-3',
        xs: 'h-8 px-2 text-caption',
        icon: 'size-11 rounded-full',
        'icon-sm': 'size-9 rounded-full',
        'icon-xs': 'size-7 rounded-full',
        'icon-lg': 'size-12 rounded-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
