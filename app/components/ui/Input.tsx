'use client'

import { cn } from '@/app/lib/utils'
import { forwardRef } from 'react'
import type { LucideIcon } from 'lucide-react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: LucideIcon
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ icon: Icon, className, ...props }, ref) => {
    return (
      <div className="relative">
        {Icon && (
          <Icon
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--color-text-muted)' }}
          />
        )}
        <input
          ref={ref}
          className={cn(
            'w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)]',
            'text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)]',
            'transition-all duration-200',
            'focus:outline-none focus:border-[var(--color-accent)]/50 focus:bg-[var(--color-surface-hover)]',
            Icon ? 'pl-8 pr-3 py-2' : 'px-3 py-2',
            className
          )}
          {...props}
        />
      </div>
    )
  }
)

Input.displayName = 'Input'
