'use client'

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  className?: string
}

export function Sparkline({ data, width = 120, height = 32, color = 'var(--color-accent)', className }: SparklineProps) {
  if (!data || data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((val - min) / range) * (height - 4) - 2
    return `${x},${y}`
  })

  const polyline = points.join(' ')

  // Area path
  const firstX = 0
  const lastX = width
  const bottomY = height
  const area = `M ${firstX},${bottomY} L ${points[0]} L ${points.slice(1).join(' L ')} L ${lastX},${bottomY} Z`

  return (
    <svg
      width={width}
      height={height}
      className={className}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={`spark-grad-${color.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={area}
        fill={`url(#spark-grad-${color.replace(/[^a-zA-Z0-9]/g, '')})`}
      />
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
