'use client'

import { DAYS_RU } from '@/app/lib/constants'

interface BarChartMiniProps {
  data: number[]
  labels?: string[]
  height?: number
  color?: string
  className?: string
}

export function BarChartMini({
  data,
  labels = DAYS_RU,
  height = 80,
  color = 'var(--color-accent)',
  className,
}: BarChartMiniProps) {
  if (!data || data.length === 0) return null

  const max = Math.max(...data, 1)
  const barWidth = 100 / (data.length * 2 - 1)

  return (
    <div className={className} style={{ width: '100%', height }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '100%' }}>
        {data.map((val, i) => {
          const barHeight = (val / max) * (height - 20)
          const isLast = i === data.length - 1
          return (
            <div
              key={i}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
            >
              <div
                style={{
                  width: '100%',
                  height: `${barHeight}px`,
                  background: isLast ? color : `${color}55`,
                  borderRadius: '3px 3px 0 0',
                  transition: `height 0.6s cubic-bezier(0,0,0.2,1) ${i * 60}ms`,
                  minHeight: 2,
                }}
              />
              <span
                style={{
                  fontSize: '9px',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: 'var(--color-text-muted)',
                  whiteSpace: 'nowrap',
                }}
              >
                {labels[i] || i + 1}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
