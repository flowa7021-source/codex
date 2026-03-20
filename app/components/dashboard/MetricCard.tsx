'use client'

import { motion } from 'framer-motion'
import { useAnimatedValue } from '@/app/hooks/use-animated-value'
import { Sparkline } from '@/app/components/charts/Sparkline'
import { cn } from '@/app/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface MetricCardProps {
  label: string
  value: number
  suffix?: string
  prefix?: string
  delta?: number
  deltaLabel?: string
  color: string
  icon: LucideIcon
  sparkline?: number[]
  delay?: number
  className?: string
}

export function MetricCard({
  label,
  value,
  suffix,
  prefix,
  delta,
  deltaLabel = 'vs прошл. нед.',
  color,
  icon: Icon,
  sparkline,
  delay = 0,
  className,
}: MetricCardProps) {
  const animatedValue = useAnimatedValue(value, 1200, delay)
  const isPositive = delta !== undefined && delta >= 0
  const deltaColor = isPositive ? 'var(--color-success)' : 'var(--color-danger)'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: delay / 1000, ease: [0.4, 0, 0.2, 1] }}
      className={cn('relative overflow-hidden rounded-lg p-5', className)}
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* Top accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5"
        style={{ background: `linear-gradient(to right, ${color}, transparent)` }}
      />

      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Icon + Label */}
          <div className="flex items-center gap-2 mb-3">
            <Icon size={16} style={{ color }} />
            <span
              className="font-mono font-medium tracking-wide uppercase"
              style={{ fontSize: 11, color: 'var(--color-text-muted)', letterSpacing: '0.08em' }}
            >
              {label}
            </span>
          </div>

          {/* Value */}
          <div className="flex items-baseline gap-1">
            <span
              className="font-mono font-bold tabular-nums"
              style={{ fontSize: 32, lineHeight: 1, color: 'var(--color-text)' }}
            >
              {animatedValue}
            </span>
            {suffix && (
              <span className="font-mono" style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>
                {suffix}
              </span>
            )}
          </div>

          {/* Delta */}
          {delta !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              <span
                className="font-mono font-semibold"
                style={{ fontSize: 11, color: deltaColor }}
              >
                {isPositive ? '▲' : '▼'} {Math.abs(delta)}%
              </span>
              <span className="font-mono" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                {deltaLabel}
              </span>
            </div>
          )}
        </div>

        {/* Sparkline */}
        {sparkline && (
          <div className="flex-shrink-0 ml-3 mt-1">
            <Sparkline data={sparkline} width={120} height={36} color={color} />
          </div>
        )}
      </div>
    </motion.div>
  )
}
