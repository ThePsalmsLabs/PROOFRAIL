import { HTMLAttributes, forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils/cn'

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
        primary: "bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300",
        success: "bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300",
        warning: "bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-300",
        error: "bg-error-100 text-error-700 dark:bg-error-900 dark:text-error-300",
        outline: "border border-neutral-300 text-neutral-700 dark:border-neutral-700 dark:text-neutral-300",
      },
      size: {
        sm: "px-2 py-0.5 text-xs",
        md: "px-3 py-1 text-xs",
        lg: "px-4 py-1.5 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean
}

const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, size, dot, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn(badgeVariants({ variant, size, className }))} {...props}>
        {dot && (
          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
        )}
        {children}
      </div>
    )
  }
)

Badge.displayName = "Badge"

export { Badge, badgeVariants }
