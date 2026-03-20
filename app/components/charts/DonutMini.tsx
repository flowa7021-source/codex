'use client'

interface DonutMiniProps {
  value: number
  max?: number
  size?: number
  color?: string
  trackColor?: string
  className?: string
}

export function DonutMini({
  value,
  max = 100,
  size = 36,
  color = 'var(--color-accent)',
  trackColor = 'var(--color-border)',
  className,
}: DonutMiniProps) {
  const radius = (size - 4) / 2
  const circumference = 2 * Math.PI * radius
  const progress = Math.min(value / max, 1)
  const strokeDashoffset = circumference * (1 - progress)

  return (
    <svg width={size} height={size} className={className} style={{ transform: 'rotate(-90deg)' }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={trackColor}
        strokeWidth={3}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0,0,0.2,1)' }}
      />
    </svg>
  )
}
