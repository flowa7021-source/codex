'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  FileText, CheckSquare, AlertTriangle, Clock,
  ArrowRight, Plus, Check, TrendingUp,
} from 'lucide-react'
import Link from 'next/link'
import { StatusBadge } from '@/app/components/ui/StatusBadge'
import { formatDate } from '@/app/lib/utils'
import { PRIORITY_COLORS, DOCUMENT_STATUS_COLORS, TASK_STATUS_COLORS } from '@/app/lib/constants'
import type { Document, Task, TaskStatus } from '@/app/types'

// ─── localStorage helpers (same keys as tasks/docs pages) ────────────────────
function parseDates<T extends { createdAt: unknown; updatedAt: unknown; dueDate?: unknown; completedAt?: unknown }>(raw: T[]): T[] {
  return raw.map(item => ({
    ...item,
    createdAt: new Date(item.createdAt as string),
    updatedAt: new Date(item.updatedAt as string),
    dueDate: item.dueDate ? new Date(item.dueDate as string) : undefined,
    completedAt: item.completedAt ? new Date(item.completedAt as string) : undefined,
  }))
}

function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem('nexus-tasks')
    if (raw) return parseDates(JSON.parse(raw)) as Task[]
  } catch {}
  return []
}

function loadDocs(): Document[] {
  try {
    const raw = localStorage.getItem('nexus-documents')
    if (raw) return parseDates(JSON.parse(raw)) as Document[]
  } catch {}
  return []
}

function saveTasks(tasks: Task[]) {
  try { localStorage.setItem('nexus-tasks', JSON.stringify(tasks)) } catch {}
}

// ─── Subcomponents ────────────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.07, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } }),
} as const

function MetricTile({
  label, value, sub, color, icon: Icon, index,
}: {
  label: string; value: number; sub?: string; color: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; index: number
}) {
  return (
    <motion.div
      custom={index} variants={fadeUp} initial="hidden" animate="visible"
      className="rounded-xl p-5 flex flex-col gap-4 relative overflow-hidden"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* Subtle top-left accent line */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: '60%',
          height: 1,
          background: `linear-gradient(to right, ${color}50, transparent)`,
        }}
      />
      {/* Subtle background glow */}
      <div
        style={{
          position: 'absolute',
          top: -20, left: -20,
          width: 100, height: 100,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${color}0D 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      <div className="flex items-start justify-between relative">
        <span
          className="font-mono uppercase"
          style={{ fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: '0.12em' }}
        >
          {label}
        </span>
        <div
          className="p-2 rounded-lg flex-shrink-0"
          style={{
            background: `${color}14`,
            border: `1px solid ${color}22`,
          }}
        >
          <span style={{ color, display: 'flex' }}><Icon size={14} strokeWidth={2} /></span>
        </div>
      </div>

      <div className="flex items-end gap-2 relative">
        <span
          className="font-mono font-bold tabular-nums leading-none"
          style={{ fontSize: 36, color }}
        >
          {value}
        </span>
        {sub && (
          <span
            className="font-mono pb-0.5"
            style={{ fontSize: 12, color: 'var(--color-text-muted)' }}
          >
            {sub}
          </span>
        )}
      </div>
    </motion.div>
  )
}

function SectionHeader({ title, href, count }: { title: string; href: string; count?: number }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <span
          className="font-mono font-semibold uppercase"
          style={{ fontSize: 10, color: 'var(--color-text-secondary)', letterSpacing: '0.12em' }}
        >
          {title}
        </span>
        {count !== undefined && count > 0 && (
          <span
            className="font-mono px-1.5 py-0.5 rounded-md tabular-nums"
            style={{
              fontSize: 10,
              background: 'var(--color-overlay)',
              color: 'var(--color-text-muted)',
              border: '1px solid var(--color-border)',
            }}
          >
            {count}
          </span>
        )}
      </div>
      <Link
        href={href}
        className="flex items-center gap-1 font-mono transition-all duration-150"
        style={{ fontSize: 11, color: 'var(--color-accent)', letterSpacing: '0.02em' }}
        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-accent-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-accent)'}
      >
        Все <ArrowRight size={10} />
      </Link>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const today = new Date()
  const dateStr = today.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })

  const [tasks, setTasks] = useState<Task[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(() => {
    setTasks(loadTasks())
    setDocuments(loadDocs())
    setLoaded(true)
  }, [])

  useEffect(() => {
    reload()
    // Refresh when returning to this tab / page
    const onVisible = () => { if (!document.hidden) reload() }
    const onStorage = () => reload()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('storage', onStorage)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('storage', onStorage)
    }
  }, [reload])

  // ── Derived metrics ─────────────────────────────────────────────────────────
  const activeTasks = tasks.filter(t => !['DONE', 'CANCELLED'].includes(t.status))
  const doneTasks   = tasks.filter(t => t.status === 'DONE')
  const overdueTasks = tasks.filter(t =>
    t.dueDate && new Date(t.dueDate) < today && !['DONE', 'CANCELLED'].includes(t.status)
  )
  const docsTotal    = documents.length
  const docsApproved = documents.filter(d => d.status === 'APPROVED').length

  // Recent items (sorted by updatedAt)
  const recentDocs = [...documents]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6)

  const recentActiveTasks = activeTasks
    .sort((a, b) => {
      // Overdue first, then by priority weight
      const w = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
      const aOver = a.dueDate && new Date(a.dueDate) < today ? 10 : 0
      const bOver = b.dueDate && new Date(b.dueDate) < today ? 10 : 0
      return (bOver + w[b.priority]) - (aOver + w[a.priority])
    })
    .slice(0, 6)

  // ── Toggle task done (live, writes back to localStorage) ───────────────────
  const handleToggleDone = (task: Task) => {
    const isDone = task.status === 'DONE'
    const updated: Task = {
      ...task,
      status: (isDone ? 'TODO' : 'DONE') as TaskStatus,
      updatedAt: new Date(),
      completedAt: isDone ? undefined : new Date(),
    }
    const next = tasks.map(t => t.id === updated.id ? updated : t)
    setTasks(next)
    saveTasks(next)
  }

  // ── Empty state helper ─────────────────────────────────────────────────────
  const isEmpty = loaded && tasks.length === 0 && documents.length === 0

  return (
    <div className="p-6 space-y-5" style={{ maxWidth: 1200 }}>

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: 'var(--color-text)',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            Оперативная сводка
          </h1>
          <p
            className="mt-1 capitalize"
            style={{ fontSize: 12, color: 'var(--color-text-muted)', letterSpacing: '0.01em' }}
          >
            {dateStr}
          </p>
        </div>
        {!isEmpty && (
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/tasks"
              className="flex items-center gap-1.5 rounded-lg transition-all duration-150"
              style={{
                padding: '6px 12px',
                fontSize: 12,
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-muted)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border-strong)'
                e.currentTarget.style.color = 'var(--color-text-secondary)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border)'
                e.currentTarget.style.color = 'var(--color-text-muted)'
              }}
            >
              <Plus size={13} strokeWidth={2} /> Задача
            </Link>
            <Link
              href="/dashboard/documents"
              className="flex items-center gap-1.5 rounded-lg transition-all duration-150"
              style={{
                padding: '6px 12px',
                fontSize: 12,
                background: 'var(--color-accent)',
                color: '#fff',
                fontWeight: 500,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-accent-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-accent)'}
            >
              <Plus size={13} strokeWidth={2} /> Документ
            </Link>
          </div>
        )}
      </div>

      {/* ── Empty state ─────────────────────────────────────────────────────── */}
      {isEmpty ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-xl p-12 text-center"
          style={{ background: 'var(--color-surface)', border: '1px dashed var(--color-border)' }}
        >
          <div className="font-mono mb-2" style={{ fontSize: 32, color: 'var(--color-border)' }}>⬡</div>
          <p className="font-mono font-semibold mb-1" style={{ fontSize: 15, color: 'var(--color-text)' }}>
            Всё чисто
          </p>
          <p className="font-sans mb-6" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            Задач и документов пока нет. Начните с создания первого элемента.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/dashboard/tasks"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-mono transition-all"
              style={{ fontSize: 13, background: 'var(--color-accent)', color: 'var(--color-bg)' }}
            >
              <CheckSquare size={14} /> Создать задачу
            </Link>
            <Link
              href="/dashboard/documents"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-mono transition-all"
              style={{ fontSize: 13, background: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              <FileText size={14} /> Создать документ
            </Link>
          </div>
        </motion.div>
      ) : (
        <>
          {/* ── Metric tiles ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-4 gap-3">
            <MetricTile
              index={0} label="Активных задач" value={activeTasks.length}
              sub={tasks.length > 0 ? `/ ${tasks.length}` : undefined}
              color="var(--color-info)" icon={CheckSquare}
            />
            <MetricTile
              index={1} label="Завершено" value={doneTasks.length}
              sub={tasks.length > 0 ? `из ${tasks.length}` : undefined}
              color="var(--color-success)" icon={TrendingUp}
            />
            <MetricTile
              index={2} label="Документов" value={docsTotal}
              sub={docsApproved > 0 ? `${docsApproved} утверждено` : undefined}
              color="var(--color-accent)" icon={FileText}
            />
            <MetricTile
              index={3} label="Просрочено" value={overdueTasks.length}
              color={overdueTasks.length > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)'}
              icon={AlertTriangle}
            />
          </div>

          {/* ── Middle row: docs + tasks ────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4">

            {/* Documents */}
            <motion.div
              custom={4} variants={fadeUp} initial="hidden" animate="visible"
              className="rounded-xl p-5"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
              }}
            >
              <SectionHeader title="Документы" href="/dashboard/documents" count={documents.length} />
              {recentDocs.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="font-sans" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Нет документов</p>
                  <Link href="/dashboard/documents" className="font-mono inline-block mt-2" style={{ fontSize: 12, color: 'var(--color-accent)' }}>
                    + Создать
                  </Link>
                </div>
              ) : (
                <div className="space-y-px">
                  {recentDocs.map(doc => (
                    <Link
                      key={doc.id}
                      href="/dashboard/documents"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
                      style={{ textDecoration: 'none' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_COLORS[doc.priority], flexShrink: 0 }} />
                      <div className="flex-1 min-w-0">
                        <div className="font-sans truncate" style={{ fontSize: 13, color: 'var(--color-text)' }}>
                          <span className="font-mono" style={{ color: 'var(--color-accent)', marginRight: 6 }}>{doc.number}</span>
                          {doc.title}
                        </div>
                        {doc.dueDate && (
                          <div className="font-mono mt-0.5" style={{ fontSize: 10, color: new Date(doc.dueDate) < today ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                            до {formatDate(doc.dueDate, 'dd.MM.yy')}
                          </div>
                        )}
                      </div>
                      <div
                        className="font-mono px-2 py-0.5 rounded-md flex-shrink-0"
                        style={{ fontSize: 10, background: `${DOCUMENT_STATUS_COLORS[doc.status]}15`, color: DOCUMENT_STATUS_COLORS[doc.status] }}
                      >
                        {doc.status === 'DRAFT' ? 'Черновик' :
                         doc.status === 'ACTIVE' ? 'В работе' :
                         doc.status === 'REVIEW' ? 'Проверка' :
                         doc.status === 'APPROVED' ? 'Утверждён' :
                         doc.status === 'REJECTED' ? 'Отклонён' : 'Архив'}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Tasks */}
            <motion.div
              custom={5} variants={fadeUp} initial="hidden" animate="visible"
              className="rounded-xl p-5"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
              }}
            >
              <SectionHeader title="Активные задачи" href="/dashboard/tasks" count={activeTasks.length} />
              {recentActiveTasks.length === 0 && tasks.length > 0 ? (
                <div className="py-8 text-center">
                  <p className="font-sans" style={{ fontSize: 13, color: 'var(--color-success)' }}>✓ Все задачи завершены</p>
                </div>
              ) : recentActiveTasks.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="font-sans" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Нет задач</p>
                  <Link href="/dashboard/tasks" className="font-mono inline-block mt-2" style={{ fontSize: 12, color: 'var(--color-accent)' }}>
                    + Создать
                  </Link>
                </div>
              ) : (
                <div className="space-y-px">
                  {recentActiveTasks.map(task => {
                    const isOverdue = task.dueDate && new Date(task.dueDate) < today
                    const isDone = task.status === 'DONE'
                    return (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer"
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-hover)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        {/* Checkbox */}
                        <button
                          onClick={() => handleToggleDone(task)}
                          style={{
                            width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                            border: `1.5px solid ${isDone ? 'var(--color-success)' : isOverdue ? 'var(--color-danger)' : 'var(--color-border)'}`,
                            background: isDone ? 'var(--color-success-dim)' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', transition: 'all 0.2s',
                          }}
                        >
                          {isDone && <Check size={10} style={{ color: 'var(--color-success)' }} />}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div
                            className="font-sans truncate"
                            style={{ fontSize: 13, color: isDone ? 'var(--color-text-muted)' : 'var(--color-text)', textDecoration: isDone ? 'line-through' : 'none' }}
                          >
                            {task.title}
                          </div>
                          {task.dueDate && (
                            <div className="font-mono mt-0.5" style={{ fontSize: 10, color: isOverdue ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                              {isOverdue ? '⚠ просрочено · ' : ''}до {formatDate(task.dueDate, 'dd.MM.yy')}
                            </div>
                          )}
                        </div>

                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_COLORS[task.priority], display: 'block', flexShrink: 0 }} />
                      </div>
                    )
                  })}
                </div>
              )}
            </motion.div>
          </div>

          {/* ── Bottom row: status breakdown ─────────────────────────────────── */}
          {(tasks.length > 0 || documents.length > 0) && (
            <div className="grid grid-cols-2 gap-4">

              {/* Task status breakdown */}
              {tasks.length > 0 && (
                <motion.div
                  custom={6} variants={fadeUp} initial="hidden" animate="visible"
                  className="rounded-xl p-5"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                >
                  <span className="font-mono font-semibold uppercase block mb-4" style={{ fontSize: 11, color: 'var(--color-text-secondary)', letterSpacing: '0.1em' }}>
                    Задачи по статусу
                  </span>
                  <div className="space-y-2.5">
                    {(['TODO', 'ACTIVE', 'PENDING', 'REVIEW', 'DONE'] as const).map(status => {
                      const count = tasks.filter(t => t.status === status).length
                      if (count === 0) return null
                      const pct = Math.round((count / tasks.length) * 100)
                      const labels: Record<string, string> = { TODO: 'Новые', ACTIVE: 'В работе', PENDING: 'Ожидание', REVIEW: 'На проверке', DONE: 'Завершено' }
                      return (
                        <div key={status}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono" style={{ fontSize: 11, color: TASK_STATUS_COLORS[status] }}>{labels[status]}</span>
                            <span className="font-mono" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{count}</span>
                          </div>
                          <div style={{ height: 5, borderRadius: 3, background: 'var(--color-elevated)', overflow: 'hidden' }}>
                            <motion.div
                              initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.6, delay: 0.3, ease: [0.4, 0, 0.2, 1] }}
                              style={{ height: '100%', background: TASK_STATUS_COLORS[status], borderRadius: 3 }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </motion.div>
              )}

              {/* Document status breakdown */}
              {documents.length > 0 && (
                <motion.div
                  custom={7} variants={fadeUp} initial="hidden" animate="visible"
                  className="rounded-xl p-5"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                >
                  <span className="font-mono font-semibold uppercase block mb-4" style={{ fontSize: 11, color: 'var(--color-text-secondary)', letterSpacing: '0.1em' }}>
                    Документы по статусу
                  </span>
                  <div className="space-y-2.5">
                    {(['DRAFT', 'ACTIVE', 'REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED'] as const).map(status => {
                      const count = documents.filter(d => d.status === status).length
                      if (count === 0) return null
                      const pct = Math.round((count / documents.length) * 100)
                      const labels: Record<string, string> = { DRAFT: 'Черновики', ACTIVE: 'В работе', REVIEW: 'На проверке', APPROVED: 'Утверждены', REJECTED: 'Отклонены', ARCHIVED: 'Архив' }
                      return (
                        <div key={status}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono" style={{ fontSize: 11, color: DOCUMENT_STATUS_COLORS[status] }}>{labels[status]}</span>
                            <span className="font-mono" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{count}</span>
                          </div>
                          <div style={{ height: 5, borderRadius: 3, background: 'var(--color-elevated)', overflow: 'hidden' }}>
                            <motion.div
                              initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.6, delay: 0.35, ease: [0.4, 0, 0.2, 1] }}
                              style={{ height: '100%', background: DOCUMENT_STATUS_COLORS[status], borderRadius: 3 }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
