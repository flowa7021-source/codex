'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  FileText, CheckSquare, Users, Zap, ArrowRight
} from 'lucide-react'
import Link from 'next/link'
import { MetricCard } from '@/app/components/dashboard/MetricCard'
import { ActivityFeed } from '@/app/components/dashboard/ActivityFeed'
import { BarChartMini } from '@/app/components/charts/BarChartMini'
import { DonutMini } from '@/app/components/charts/DonutMini'
import { Avatar } from '@/app/components/ui/Avatar'
import { StatusBadge } from '@/app/components/ui/StatusBadge'
import { formatDate } from '@/app/lib/utils'
import { PRIORITY_COLORS } from '@/app/lib/constants'
import type { Document, Task, ActivityLog, User } from '@/app/types'

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] as any } },
}

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <span
        className="font-mono font-semibold uppercase tracking-widest"
        style={{ fontSize: 11, color: 'var(--color-text-secondary)', letterSpacing: '0.1em' }}
      >
        {title}
      </span>
      <Link
        href={href}
        className="flex items-center gap-1 font-mono text-xs transition-colors duration-200"
        style={{ color: 'var(--color-accent)', fontSize: 12 }}
      >
        Все <ArrowRight size={12} />
      </Link>
    </div>
  )
}

interface Metrics {
  documentsInProgress: number
  documentsTotal: number
  tasksCompletedThisWeek: number
  totalTasksThisWeek: number
  teamOnline: number
  teamTotal: number
  avgKpi: number
  deltas: { documents: number; tasks: number; team: number; kpi: number }
}

export default function DashboardPage() {
  const today = new Date()
  const dateStr = today.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [users, setUsers] = useState<(User & { assignedTasks: Task[] })[]>([])
  const [weeklyData, setWeeklyData] = useState<number[]>([])

  useEffect(() => {
    const api = window.electronAPI

    api.getMetricsOverview().then(setMetrics).catch(console.error)

    api.getDocuments({ pageSize: 5, status: 'REVIEW' })
      .then(async ({ data }) => {
        const all: Document[] = data || []
        if (all.length < 5) {
          const { data: active } = await api.getDocuments({ pageSize: 5, status: 'ACTIVE' })
          setDocuments([...all, ...(active || [])].slice(0, 5))
        } else {
          setDocuments(all.slice(0, 5))
        }
      })
      .catch(console.error)

    api.getTasks()
      .then((all: Task[]) => {
        setTasks(all.filter((t: Task) => !['DONE', 'CANCELLED'].includes(t.status)).slice(0, 5))
      })
      .catch(console.error)

    api.getActivity({ limit: 8 }).then(setActivities).catch(console.error)

    api.getTeam().then(users => setUsers(users.slice(0, 5))).catch(console.error)

    api.getMetricsWeekly()
      .then(setWeeklyData)
      .catch(() => setWeeklyData([3, 5, 4, 7, 6, 8, 5]))
  }, [])

  const sparkline = [20, 25, 30, 28, 35, 32, 38]

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl">
      {/* Page header */}
      <div>
        <h1 className="font-mono font-bold" style={{ fontSize: 26, color: 'var(--color-text)' }}>
          Оперативная сводка
        </h1>
        <p className="font-sans mt-1" style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>
          Статус подразделения на {dateStr}
        </p>
      </div>

      {/* KPI cards */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-4 gap-4"
        style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}
      >
        <MetricCard
          label="Документы в работе"
          value={metrics?.documentsInProgress ?? 0}
          suffix={`/ ${metrics?.documentsTotal ?? 0}`}
          delta={metrics?.deltas.documents}
          color="var(--color-info)"
          icon={FileText}
          sparkline={sparkline}
          delay={0}
        />
        <MetricCard
          label="Задач завершено"
          value={metrics?.tasksCompletedThisWeek ?? 0}
          suffix={`/ ${metrics?.totalTasksThisWeek ?? 0}`}
          delta={metrics?.deltas.tasks}
          color="var(--color-success)"
          icon={CheckSquare}
          sparkline={sparkline}
          delay={100}
        />
        <MetricCard
          label="Команда онлайн"
          value={metrics?.teamOnline ?? 0}
          suffix={`/ ${metrics?.teamTotal ?? 0}`}
          color="var(--color-accent)"
          icon={Users}
          sparkline={sparkline}
          delay={200}
        />
        <MetricCard
          label="Средний KPI"
          value={metrics?.avgKpi ?? 0}
          suffix="%"
          delta={metrics?.deltas.kpi}
          color="var(--color-warning)"
          icon={Zap}
          sparkline={sparkline}
          delay={300}
        />
      </motion.div>

      {/* Middle row */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Documents */}
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.35 }}
          className="rounded-lg p-4"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <SectionHeader title="ДОКУМЕНТООБОРОТ" href="/dashboard/documents" />
          <div className="space-y-1">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-200"
                style={{ borderBottom: '1px solid transparent' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-surface-hover)'
                  e.currentTarget.style.borderColor = 'var(--color-border-subtle)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.borderColor = 'transparent'
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: PRIORITY_COLORS[doc.priority],
                    flexShrink: 0,
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div
                    className="font-sans font-medium truncate"
                    style={{ fontSize: 13, color: 'var(--color-text)' }}
                  >
                    {doc.number} — {doc.title}
                  </div>
                  <div className="font-sans" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {doc.author?.name ?? ''}
                  </div>
                </div>
                <StatusBadge type="document" status={doc.status} />
                <span
                  className="font-mono flex-shrink-0"
                  style={{ fontSize: 11, color: 'var(--color-text-muted)' }}
                >
                  {doc.dueDate ? formatDate(doc.dueDate, 'dd.MM') : '—'}
                </span>
              </div>
            ))}
            {documents.length === 0 && (
              <p className="font-sans text-center py-4" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                Нет документов
              </p>
            )}
          </div>
        </motion.div>

        {/* Tasks */}
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.45 }}
          className="rounded-lg p-4"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <SectionHeader title="АКТИВНЫЕ ЗАДАЧИ" href="/dashboard/tasks" />
          <div className="space-y-1">
            {tasks.map((task) => {
              const isOverdue = task.dueDate && new Date(task.dueDate) < new Date()
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-200"
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      border: `1.5px solid ${isOverdue ? 'var(--color-danger)' : 'var(--color-border)'}`,
                      flexShrink: 0,
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-sans truncate"
                      style={{ fontSize: 13, color: 'var(--color-text)' }}
                    >
                      {task.title}
                    </div>
                    {task.assignee && (
                      <div className="font-sans" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                        {task.assignee.name}
                      </div>
                    )}
                  </div>
                  {task.dueDate && (
                    <span
                      className="font-mono flex-shrink-0"
                      style={{
                        fontSize: 11,
                        color: isOverdue ? 'var(--color-danger)' : 'var(--color-text-muted)',
                      }}
                    >
                      до {formatDate(task.dueDate, 'dd.MM')}
                    </span>
                  )}
                </div>
              )
            })}
            {tasks.length === 0 && (
              <p className="font-sans text-center py-4" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                Нет активных задач
              </p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Bottom row */}
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: '1fr 280px 280px' }}
      >
        {/* Activity feed */}
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.5 }}
        >
          <ActivityFeed activities={activities} />
        </motion.div>

        {/* Weekly productivity */}
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.55 }}
          className="rounded-lg p-4"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <div className="mb-3">
            <span
              className="font-mono font-semibold uppercase tracking-widest"
              style={{ fontSize: 11, color: 'var(--color-text-secondary)', letterSpacing: '0.1em' }}
            >
              ПРОДУКТИВНОСТЬ
            </span>
          </div>
          <BarChartMini data={weeklyData.length > 0 ? weeklyData : sparkline} height={100} />
          <div className="mt-3">
            <span className="font-mono font-bold" style={{ fontSize: 24, color: 'var(--color-text)' }}>
              {(weeklyData.length > 0 ? weeklyData : sparkline).reduce((a, b) => a + b, 0)}
            </span>
            <span className="font-mono ml-2" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              действий
            </span>
          </div>
        </motion.div>

        {/* Mini team */}
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.6 }}
          className="rounded-lg p-4"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <SectionHeader title="КОМАНДА" href="/dashboard/team" />
          <div className="space-y-2">
            {users.map((user) => {
              const userTasks = user.assignedTasks ?? []
              const doneTasks = userTasks.filter((t: Task) => t.status === 'DONE').length
              return (
                <div key={user.id} className="flex items-center gap-2">
                  <Avatar name={user.name} size={32} status={user.status} showStatus />
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-sans truncate"
                      style={{ fontSize: 12, color: 'var(--color-text)' }}
                    >
                      {user.name}
                    </div>
                    <div className="font-mono" style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                      {userTasks.length} задач
                    </div>
                  </div>
                  <DonutMini value={doneTasks} max={Math.max(userTasks.length, 1)} size={28} />
                </div>
              )
            })}
            {users.length === 0 && (
              <p className="font-sans text-center py-4" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                Загрузка...
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
