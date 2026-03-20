'use client'

import { cn } from '@/app/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'muted'
  size?: 'sm' | 'md'
  className?: string
}

const variantClasses = {
  default: 'bg-[var(--color-border)] text-[var(--color-text-secondary)]',
  success: 'bg-[var(--color-success-dim)] text-[var(--color-success)]',
  warning: 'bg-[var(--color-warning-dim)] text-[var(--color-warning)]',
  danger: 'bg-[var(--color-danger-dim)] text-[var(--color-danger)]',
  info: 'bg-[var(--color-info-dim)] text-[var(--color-info)]',
  accent: 'bg-[var(--color-accent-dim)] text-[var(--color-accent)]',
  muted: 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]',
}

export function Badge({ children, variant = 'default', size = 'sm', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm font-mono font-semibold tracking-wide',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
