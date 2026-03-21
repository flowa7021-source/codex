'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { formatDate } from '@/app/lib/utils'
import { DOCUMENT_STATUS_LABELS, DOCUMENT_STATUS_COLORS, TASK_STATUS_LABELS, TASK_STATUS_COLORS } from '@/app/lib/constants'
import type { DocumentStatus, TaskStatus } from '@/app/types'
import { Avatar } from '@/app/components/ui/Avatar'

type Period = 'week' | 'month' | 'quarter' | 'year'

const PERIODS: { id: Period; label: string; days: number }[] = [
  { id: 'week', label: 'Неделя', days: 7 },
  { id: 'month', label: 'Месяц', days: 30 },
  { id: 'quarter', label: 'Квартал', days: 90 },
  { id: 'year', label: 'Год', days: 365 },
]

const CHART_STYLE = {
  stroke: 'var(--color-text-muted)',
  fontSize: 11,
  fontFamily: 'JetBrains Mono, monospace',
}

const ALL_DOC_STATUSES: DocumentStatus[] = ['DRAFT', 'ACTIVE', 'REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED']
const ALL_TASK_STATUSES: TaskStatus[] = ['TODO', 'ACTIVE', 'PENDING', 'REVIEW', 'DONE', 'CANCELLED']

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

function dayLabel(date: Date, days: number) {
  if (days <= 7) return formatDate(date, 'EEE')
  if (days <= 30) return formatDate(date, 'dd.MM')
  if (days <= 90) return formatDate(date, 'dd.MM')
  return formatDate(date, 'MMM')
}

function groupByDay<T extends { createdAt: Date }>(items: T[], days: number): Map<string, T[]> {
  const map = new Map<string, T[]>()
  const cutoff = Date.now() - days * 86400000
  items
    .filter(i => new Date(i.createdAt).getTime() > cutoff)
    .forEach(i => {
      const key = new Date(i.createdAt).toISOString().slice(0, 10)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(i)
    })
  return map
}

function buildTimeline(tasks: any[], docs: any[], days: number) {
  const buckets = days <= 30 ? days : days <= 90 ? Math.ceil(days / 7) : 12
  const msPerBucket = (days * 86400000) / buckets
  const now = Date.now()
  const cutoff = now - days * 86400000

  return Array.from({ length: buckets }, (_, i) => {
    const bucketStart = cutoff + i * msPerBucket
    const bucketEnd = bucketStart + msPerBucket
    const bucketDate = new Date(bucketStart + msPerBucket / 2)

    const docsCreated = docs.filter(d => {
      const t = new Date(d.createdAt).getTime()
      return t >= bucketStart && t < bucketEnd
    }).length

    const docsCompleted = docs.filter(d => {
      const t = new Date(d.updatedAt).getTime()
      return t >= bucketStart && t < bucketEnd && (d.status === 'APPROVED' || d.status === 'ARCHIVED')
    }).length

    const tasksCreated = tasks.filter(t => {
      const ts = new Date(t.createdAt).getTime()
      return ts >= bucketStart && ts < bucketEnd
    }).length

    const tasksDone = tasks.filter(t => {
      const ts = new Date(t.updatedAt).getTime()
      return ts >= bucketStart && ts < bucketEnd && t.status === 'DONE'
    }).length

    return {
      date: dayLabel(bucketDate, days),
      docsCreated,
      docsCompleted,
      tasksCreated,
      tasksDone,
    }
  })
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('week')
  const [tasks, setTasks] = useState<any[]>([])
  const [docs, setDocs] = useState<any[]>([])
  const [team, setTeam] = useState<any[]>([])

  useEffect(() => {
    try {
      const t = localStorage.getItem('nexus-tasks')
      if (t) setTasks(JSON.parse(t))
    } catch {}
    try {
      const d = localStorage.getItem('nexus-documents')
      if (d) setDocs(JSON.parse(d))
    } catch {}
    try {
      const tm = localStorage.getItem('nexus-team')
      if (tm) setTeam(JSON.parse(tm))
    } catch {}
  }, [])

  const days = PERIODS.find(p => p.id === period)?.days ?? 7

  const timeline = useMemo(() => buildTimeline(tasks, docs, days), [tasks, docs, days])

  const docStatusData = useMemo(() =>
    ALL_DOC_STATUSES
      .map(status => ({ status, count: docs.filter(d => d.status === status).length }))
      .filter(d => d.count > 0),
    [docs]
  )
  const totalDocs = docStatusData.reduce((acc, d) => acc + d.count, 0)

  const taskStatusData = useMemo(() =>
    ALL_TASK_STATUSES
      .map(status => ({ status, count: tasks.filter(t => t.status === status).length }))
      .filter(d => d.count > 0),
    [tasks]
  )
  const totalTasks = taskStatusData.reduce((acc, t) => acc + t.count, 0)

  const leaderboard = useMemo(() => {
    const members = team.length > 0 ? team : [{ id: 'u1', name: 'Крот' }]
    return members.map((m: any) => {
      const userTasks = tasks.filter(t => t.assigneeId === m.id)
      const done = userTasks.filter(t => t.status === 'DONE').length
      const total = userTasks.length
      const score = total > 0 ? Math.round((done / total) * 100) : 0
      return { user: m, score, done, total }
    }).sort((a: any, b: any) => b.score - a.score)
  }, [tasks, team])

  const doneTasks = tasks.filter(t => t.status === 'DONE').length
  const totalTasksAll = tasks.length

  const isEmpty = tasks.length === 0 && docs.length === 0

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono font-bold" style={{ fontSize: 22, color: 'var(--color-text)' }}>
            Аналитика
          </h1>
          {isEmpty && (
            <p className="font-mono mt-1" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              Данных пока нет — добавьте задачи и документы
            </p>
          )}
        </div>
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

      {/* Summary tiles */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Документов всего', value: totalDocs, color: 'var(--color-accent)' },
          { label: 'Задач всего', value: totalTasksAll, color: 'var(--color-info)' },
          { label: 'Задач выполнено', value: doneTasks, color: 'var(--color-success)' },
          { label: 'Участников', value: team.length || 1, color: 'var(--color-warning)' },
        ].map(({ label, value, color }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.06 }}
            className="rounded-lg p-4"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <div className="font-mono font-bold" style={{ fontSize: 32, color }}>{value}</div>
            <div className="font-mono mt-1" style={{ fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: '0.06em' }}>
              {label.toUpperCase()}
            </div>
          </motion.div>
        ))}
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
          {docs.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={timeline}>
                <defs>
                  <linearGradient id="docGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-border-subtle)" strokeDasharray="3 3" />
                <XAxis dataKey="date" {...CHART_STYLE} tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
                <YAxis {...CHART_STYLE} tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} width={28} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="docsCreated" name="создано" stroke="var(--color-accent)" strokeWidth={2} fill="url(#docGrad)" />
                <Area type="monotone" dataKey="docsCompleted" name="завершено" stroke="var(--color-success)" strokeWidth={2} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center">
              <p className="font-mono" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Нет данных</p>
            </div>
          )}
        </motion.div>

        {/* Tasks by period */}
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
            ЗАДАЧИ ПО ПЕРИОДУ
          </h2>
          {tasks.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={timeline}>
                <CartesianGrid stroke="var(--color-border-subtle)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: 'var(--color-text-muted)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }} />
                <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }} width={28} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="tasksCreated" name="создано" fill="rgba(96,165,250,0.4)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="tasksDone" name="выполнено" fill="var(--color-info)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center">
              <p className="font-mono" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Нет данных</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Bottom row: 3 panels */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr 280px' }}>
        {/* Doc status breakdown */}
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
            ДОКУМЕНТЫ ПО СТАТУСАМ
          </h2>
          {docStatusData.length > 0 ? (
            <div className="space-y-3">
              {docStatusData.map(({ status, count }) => {
                const percent = totalDocs > 0 ? Math.round((count / totalDocs) * 100) : 0
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
                    <div style={{ height: 4, borderRadius: 2, background: 'var(--color-border)', overflow: 'hidden' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percent}%` }}
                        transition={{ duration: 0.8, delay: 0.3, ease: [0, 0, 0.2, 1] }}
                        style={{ height: '100%', background: color, borderRadius: 2 }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="font-mono" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Нет документов</p>
          )}
        </motion.div>

        {/* Task status breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.22 }}
          className="rounded-lg p-5"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <h2
            className="font-mono font-semibold uppercase tracking-widest mb-5"
            style={{ fontSize: 11, color: 'var(--color-text-secondary)', letterSpacing: '0.1em' }}
          >
            ЗАДАЧИ ПО СТАТУСАМ
          </h2>
          {taskStatusData.length > 0 ? (
            <div className="space-y-3">
              {taskStatusData.map(({ status, count }) => {
                const percent = totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0
                const color = TASK_STATUS_COLORS[status]
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-sans" style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                        {TASK_STATUS_LABELS[status]}
                      </span>
                      <span className="font-mono font-semibold" style={{ fontSize: 12, color }}>
                        {count} ({percent}%)
                      </span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'var(--color-border)', overflow: 'hidden' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percent}%` }}
                        transition={{ duration: 0.8, delay: 0.3, ease: [0, 0, 0.2, 1] }}
                        style={{ height: '100%', background: color, borderRadius: 2 }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="font-mono" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Нет задач</p>
          )}
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
          {leaderboard.length === 0 ? (
            <p className="font-mono p-4" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Нет данных</p>
          ) : (
            leaderboard.map(({ user, score, done, total }: any, index: number) => (
              <div
                key={user.id}
                className="flex items-center gap-3 px-4"
                style={{ height: 48, borderBottom: '1px solid var(--color-border-subtle)' }}
              >
                <div
                  className="flex items-center justify-center rounded-full font-mono font-bold flex-shrink-0"
                  style={{
                    width: 22, height: 22, fontSize: 11,
                    background: index === 0 ? 'var(--color-accent)' : 'transparent',
                    color: index === 0 ? 'var(--color-bg)' : 'var(--color-text-muted)',
                    border: index === 0 ? 'none' : '1px solid var(--color-border)',
                  }}
                >
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-sans truncate block" style={{ fontSize: 13, color: 'var(--color-text)' }}>
                    {user.name}
                  </span>
                  <span className="font-mono" style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                    {done}/{total} задач
                  </span>
                </div>
                <span className="font-mono font-semibold" style={{ fontSize: 13, color: 'var(--color-accent)' }}>
                  {score}%
                </span>
              </div>
            ))
          )}
        </motion.div>
      </div>
    </div>
  )
}
