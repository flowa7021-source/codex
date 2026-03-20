'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { MOCK_DAILY_METRICS, MOCK_USERS, MOCK_TASKS } from '@/app/lib/mock-data'
import { formatDate } from '@/app/lib/utils'
import { DOCUMENT_STATUS_LABELS, DOCUMENT_STATUS_COLORS } from '@/app/lib/constants'
import type { DocumentStatus } from '@/app/types'
import { Avatar } from '@/app/components/ui/Avatar'

type Period = 'week' | 'month' | 'quarter' | 'year'

const PERIODS: { id: Period; label: string }[] = [
  { id: 'week', label: 'Неделя' },
  { id: 'month', label: 'Месяц' },
  { id: 'quarter', label: 'Квартал' },
  { id: 'year', label: 'Год' },
]

const CHART_STYLE = {
  stroke: 'var(--color-text-muted)',
  fontSize: 11,
  fontFamily: 'JetBrains Mono, monospace',
}

const DOC_STATUS_DATA: { status: DocumentStatus; count: number }[] = [
  { status: 'APPROVED', count: 12 },
  { status: 'ACTIVE', count: 7 },
  { status: 'REVIEW', count: 4 },
  { status: 'DRAFT', count: 3 },
  { status: 'REJECTED', count: 2 },
  { status: 'ARCHIVED', count: 8 },
]

const TOTAL_DOCS = DOC_STATUS_DATA.reduce((acc, d) => acc + d.count, 0)

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="px-3 py-2 rounded-lg"
      style={{
        background: 'var(--color-elevated)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <p className="font-mono" style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>
        {label}
      </p>
      {payload.map((p: any) => (
        <p key={p.name} className="font-mono font-semibold" style={{ fontSize: 12, color: p.color }}>
          {p.value} {p.name}
        </p>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('week')

  const recentMetrics = MOCK_DAILY_METRICS.slice(-7)

  const areaData = recentMetrics.map(m => ({
    date: formatDate(m.date, 'dd.MM'),
    created: m.documentsCreated,
    completed: m.documentsCompleted,
  }))

  const barData = recentMetrics.map(m => ({
    date: formatDate(m.date, 'EEE'),
    tasks: m.tasksCompleted,
    created: m.tasksCreated,
  }))

  // Leaderboard
  const leaderboard = MOCK_USERS.map(user => {
    const userTasks = MOCK_TASKS.filter(t => t.assigneeId === user.id)
    const done = userTasks.filter(t => t.status === 'DONE').length
    const total = userTasks.length || 1
    return { user, score: Math.round((done / total) * 100), done, total }
  }).sort((a, b) => b.score - a.score)

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-mono font-bold" style={{ fontSize: 22, color: 'var(--color-text)' }}>
          Аналитика
        </h1>
        {/* Period toggle */}
        <div
          className="flex items-center rounded-lg p-1"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          {PERIODS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setPeriod(id)}
              className="px-3 py-1.5 rounded-md font-mono text-xs transition-all duration-200"
              style={{
                background: period === id ? 'var(--color-accent)' : 'transparent',
                color: period === id ? 'var(--color-bg)' : 'var(--color-text-muted)',
                fontSize: 12,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Top row: 2 charts */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Document trend */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-lg p-5"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <h2
            className="font-mono font-semibold uppercase tracking-widest mb-5"
            style={{ fontSize: 11, color: 'var(--color-text-secondary)', letterSpacing: '0.1em' }}
          >
            ТРЕНД ДОКУМЕНТООБОРОТА
          </h2>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={areaData}>
              <defs>
                <linearGradient id="docGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-border-subtle)" strokeDasharray="3 3" />
              <XAxis dataKey="date" {...CHART_STYLE} tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
              <YAxis {...CHART_STYLE} tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} width={28} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="created"
                name="создано"
                stroke="var(--color-accent)"
                strokeWidth={2}
                fill="url(#docGrad)"
              />
              <Area
                type="monotone"
                dataKey="completed"
                name="завершено"
                stroke="var(--color-success)"
                strokeWidth={2}
                fill="transparent"
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Tasks by day */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="rounded-lg p-5"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <h2
            className="font-mono font-semibold uppercase tracking-widest mb-5"
            style={{ fontSize: 11, color: 'var(--color-text-secondary)', letterSpacing: '0.1em' }}
          >
            ЗАДАЧИ ПО ДНЯМ
          </h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={barData}>
              <CartesianGrid stroke="var(--color-border-subtle)" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fill: 'var(--color-text-muted)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }} />
              <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }} width={28} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="created" name="создано" fill="rgba(96,165,250,0.4)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="tasks" name="выполнено" fill="var(--color-info)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Bottom row: 3 panels */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 280px 280px' }}>
        {/* Status breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.16 }}
          className="rounded-lg p-5"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <h2
            className="font-mono font-semibold uppercase tracking-widest mb-5"
            style={{ fontSize: 11, color: 'var(--color-text-secondary)', letterSpacing: '0.1em' }}
          >
            ПО СТАТУСАМ
          </h2>
          <div className="space-y-3">
            {DOC_STATUS_DATA.map(({ status, count }) => {
              const percent = Math.round((count / TOTAL_DOCS) * 100)
              const color = DOCUMENT_STATUS_COLORS[status]
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-sans" style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      {DOCUMENT_STATUS_LABELS[status]}
                    </span>
                    <span className="font-mono font-semibold" style={{ fontSize: 12, color }}>
                      {count} ({percent}%)
                    </span>
                  </div>
                  <div
                    style={{
                      height: 4,
                      borderRadius: 2,
                      background: 'var(--color-border)',
                      overflow: 'hidden',
                    }}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percent}%` }}
                      transition={{ duration: 0.8, delay: 0.3, ease: [0, 0, 0.2, 1] }}
                      style={{
                        height: '100%',
                        background: color,
                        borderRadius: 2,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* Avg processing time */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.24 }}
          className="rounded-lg p-5 flex flex-col items-center justify-center text-center"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <h2
            className="font-mono font-semibold uppercase tracking-widest mb-5"
            style={{ fontSize: 11, color: 'var(--color-text-secondary)', letterSpacing: '0.1em' }}
          >
            СРЕДНЕЕ ВРЕМЯ ОБРАБОТКИ
          </h2>
          <div className="font-mono font-bold" style={{ fontSize: 48, color: 'var(--color-accent)', lineHeight: 1 }}>
            2.4
          </div>
          <div className="font-sans mt-2" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            дня на документ
          </div>
          <div className="mt-4 flex items-center gap-1.5">
            <span className="font-mono font-semibold" style={{ fontSize: 12, color: 'var(--color-success)' }}>
              ▲ 18%
            </span>
            <span className="font-mono" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              быстрее vs прошл. мес.
            </span>
          </div>
        </motion.div>

        {/* Leaderboard */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.32 }}
          className="rounded-lg overflow-hidden"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <div className="p-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <h2
              className="font-mono font-semibold uppercase tracking-widest"
              style={{ fontSize: 11, color: 'var(--color-text-secondary)', letterSpacing: '0.1em' }}
            >
              ТОП ПРОДУКТИВНОСТИ
            </h2>
          </div>
          {leaderboard.map(({ user, score, done, total }, index) => (
            <div
              key={user.id}
              className="flex items-center gap-3 px-4"
              style={{
                height: 48,
                borderBottom: '1px solid var(--color-border-subtle)',
              }}
            >
              {/* Position badge */}
              <div
                className="flex items-center justify-center rounded-full font-mono font-bold flex-shrink-0"
                style={{
                  width: 22,
                  height: 22,
                  fontSize: 11,
                  background: index === 0 ? 'var(--color-accent)' : 'transparent',
                  color: index === 0 ? 'var(--color-bg)' : 'var(--color-text-muted)',
                  border: index === 0 ? 'none' : '1px solid var(--color-border)',
                }}
              >
                {index + 1}
              </div>
              {/* Name */}
              <div className="flex-1 min-w-0">
                <span className="font-sans truncate block" style={{ fontSize: 13, color: 'var(--color-text)' }}>
                  {user.name.split(' ')[0]} {user.name.split(' ')[1]?.[0]}.
                </span>
              </div>
              {/* Score */}
              <span className="font-mono font-semibold" style={{ fontSize: 13, color: 'var(--color-accent)' }}>
                {score}%
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}
