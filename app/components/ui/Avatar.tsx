'use client'

import { cn, getInitials } from '@/app/lib/utils'
import { ONLINE_STATUS_COLORS } from '@/app/lib/constants'
import type { OnlineStatus } from '@/app/types'

interface AvatarProps {
  name: string
  size?: number
  status?: OnlineStatus
  className?: string
  showStatus?: boolean
}

export function Avatar({ name, size = 32, status, className, showStatus = false }: AvatarProps) {
  const initials = getInitials(name)
  const fontSize = Math.round(size * 0.34)
  const dotSize = Math.round(size * 0.31)
  const dotBorder = 2

  return (
    <div className={cn('relative inline-flex flex-shrink-0', className)}>
      <div
        style={{
          width: size,
          height: size,
          fontSize,
          borderRadius: '50%',
          border: '1px solid var(--color-border)',
          background: 'var(--color-elevated)',
          color: 'var(--color-accent)',
        }}
        className="flex items-center justify-center font-mono font-semibold"
      >
        {initials}
      </div>
      {showStatus && status && (
        <span
          style={{
            width: dotSize,
            height: dotSize,
            background: ONLINE_STATUS_COLORS[status],
            border: `${dotBorder}px solid var(--color-surface)`,
            borderRadius: '50%',
            position: 'absolute',
            bottom: 0,
            right: 0,
          }}
        />
      )}
    </div>
  )
}
