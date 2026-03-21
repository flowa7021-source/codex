'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, LayoutGrid, List, X, Check, ChevronDown } from 'lucide-react'
import { Button } from '@/app/components/ui/Button'
import { StatusBadge } from '@/app/components/ui/StatusBadge'
import { KanbanBoard } from '@/app/components/tasks/KanbanBoard'
import { TaskDrawer } from '@/app/components/tasks/TaskDrawer'
import { MOCK_TASKS, MOCK_USERS } from '@/app/lib/mock-data'
import { formatDate } from '@/app/lib/utils'
import {
  PRIORITY_COLORS, PRIORITY_LABELS, TASK_STATUS_COLORS, TASK_STATUS_LABELS,
} from '@/app/lib/constants'
import type { Task, Priority, TaskStatus } from '@/app/types'

const CURRENT_USER = MOCK_USERS[0]
const PRIORITY_ORDER: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
const STATUSES_LIST: TaskStatus[] = ['TODO', 'ACTIVE', 'PENDING', 'REVIEW', 'DONE']
type ViewMode = 'kanban' | 'list'

function parseDates(raw: unknown): Task[] {
  return (raw as Task[]).map(t => ({
    ...t,
    createdAt: new Date(t.createdAt),
    updatedAt: new Date(t.updatedAt),
    dueDate: t.dueDate ? new Date(t.dueDate) : undefined,
    completedAt: t.completedAt ? new Date(t.completedAt) : undefined,
    subtasks: t.subtasks ?? [],
  }))
}

function loadTasks(): Task[] {
  try {
    const saved = localStorage.getItem('nexus-tasks')
    if (saved) return parseDates(JSON.parse(saved))
  } catch {}
  return MOCK_TASKS
}

function saveTasks(tasks: Task[]) {
  try { localStorage.setItem('nexus-tasks', JSON.stringify(tasks)) } catch {}
}

// ─── Priority dropdown ────────────────────────────────────────────────────────
function PriorityDropdown({
  value, onChange,
}: { value: Priority; onChange: (p: Priority) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md transition-all"
        style={{ background: 'var(--color-elevated)', border: `1px solid ${PRIORITY_COLORS[value]}40` }}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: PRIORITY_COLORS[value], display: 'block' }} />
        <span className="font-mono" style={{ fontSize: 11, color: PRIORITY_COLORS[value] }}>{PRIORITY_LABELS[value]}</span>
        <ChevronDown size={10} style={{ color: 'var(--color-text-muted)' }} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 100,
              background: 'var(--color-elevated)', border: '1px solid var(--color-border)',
              borderRadius: 8, boxShadow: 'var(--shadow-lg)', minWidth: 130, overflow: 'hidden',
            }}
          >
            {PRIORITY_ORDER.map(p => (
              <button
                key={p}
                onClick={(e) => { e.stopPropagation(); onChange(p); setOpen(false) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 transition-all text-left"
                style={{ background: p === value ? 'var(--color-surface-hover)' : 'transparent' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = p === value ? 'var(--color-surface-hover)' : 'transparent'}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: PRIORITY_COLORS[p], display: 'block' }} />
                <span className="font-mono" style={{ fontSize: 11, color: PRIORITY_COLORS[p] }}>{PRIORITY_LABELS[p]}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Status dropdown ──────────────────────────────────────────────────────────
function StatusDropdown({
  value, onChange,
}: { value: TaskStatus; onChange: (s: TaskStatus) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        <StatusBadge type="task" status={value} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 100,
              background: 'var(--color-elevated)', border: '1px solid var(--color-border)',
              borderRadius: 8, boxShadow: 'var(--shadow-lg)', minWidth: 150, overflow: 'hidden',
            }}
          >
            {STATUSES_LIST.map(s => (
              <button
                key={s}
                onClick={(e) => { e.stopPropagation(); onChange(s); setOpen(false) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 transition-all text-left"
                style={{ background: s === value ? 'var(--color-surface-hover)' : 'transparent' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = s === value ? 'var(--color-surface-hover)' : 'transparent'}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: TASK_STATUS_COLORS[s], display: 'block' }} />
                <span className="font-mono" style={{ fontSize: 11, color: TASK_STATUS_COLORS[s] }}>{TASK_STATUS_LABELS[s]}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── New task modal ───────────────────────────────────────────────────────────
function NewTaskModal({ onClose, onCreate }: { onClose: () => void; onCreate: (t: Task) => void }) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<Priority>('MEDIUM')
  const [status, setStatus] = useState<TaskStatus>('TODO')
  const [dueDate, setDueDate] = useState('')
  const [description, setDescription] = useState('')

  const handleCreate = () => {
    if (!title.trim()) return
    const task: Task = {
      id: `t-${Date.now()}`,
      title: title.trim(),
      description: description.trim() || undefined,
      status,
      priority,
      order: 0,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      creatorId: CURRENT_USER.id,
      creator: CURRENT_USER,
      assigneeId: CURRENT_USER.id,
      assignee: CURRENT_USER,
      createdAt: new Date(),
      updatedAt: new Date(),
      subtasks: [],
    }
    onCreate(task)
    onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="rounded-xl p-6 w-[520px]"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-mono font-bold" style={{ fontSize: 15, color: 'var(--color-text)' }}>Новая задача</h2>
          <button onClick={onClose} style={{ color: 'var(--color-text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="font-mono text-xs block mb-1.5" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.08em' }}>НАЗВАНИЕ *</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="Что нужно сделать?"
              className="w-full px-3 py-2.5 rounded-lg font-sans outline-none"
              style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: 14 }}
            />
          </div>

          <div>
            <label className="font-mono text-xs block mb-1.5" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.08em' }}>ОПИСАНИЕ</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Подробности..."
              rows={2}
              className="w-full px-3 py-2.5 rounded-lg font-sans outline-none resize-none"
              style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: 13 }}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="font-mono text-xs block mb-1.5" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.08em' }}>СТАТУС</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-3 py-2.5 rounded-lg font-mono outline-none"
                style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: TASK_STATUS_COLORS[status], fontSize: 12, colorScheme: 'dark' }}
              >
                {STATUSES_LIST.map(s => (
                  <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-mono text-xs block mb-1.5" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.08em' }}>ПРИОРИТЕТ</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full px-3 py-2.5 rounded-lg font-mono outline-none"
                style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: PRIORITY_COLORS[priority], fontSize: 12, colorScheme: 'dark' }}
              >
                {PRIORITY_ORDER.map(p => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-mono text-xs block mb-1.5" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.08em' }}>ДЕДЛАЙН</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg font-mono outline-none"
                style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: 12, colorScheme: 'dark' }}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <Button variant="secondary" size="md" onClick={onClose} className="flex-1">Отмена</Button>
          <Button variant="primary" size="md" onClick={handleCreate} className="flex-1" disabled={!title.trim()}>
            Создать задачу
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('kanban')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showNewTask, setShowNewTask] = useState(false)

  useEffect(() => {
    setTasks(loadTasks())
  }, [])

  const updateTasks = (next: Task[]) => {
    setTasks(next)
    saveTasks(next)
  }

  const handleUpdate = (updated: Task) => {
    updateTasks(tasks.map(t => t.id === updated.id ? updated : t))
    setSelectedTask(updated)
  }

  const handleDelete = (id: string) => {
    updateTasks(tasks.filter(t => t.id !== id))
    setSelectedTask(null)
  }

  const handleCreate = (task: Task) => {
    updateTasks([...tasks, task])
  }

  const handleToggleDone = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation()
    const isDone = task.status === 'DONE'
    const updated = { ...task, status: (isDone ? 'TODO' : 'DONE') as TaskStatus, updatedAt: new Date(), completedAt: isDone ? undefined : new Date() }
    updateTasks(tasks.map(t => t.id === task.id ? updated : t))
  }

  const handlePriorityChange = (task: Task, priority: Priority) => {
    const updated = { ...task, priority, updatedAt: new Date() }
    updateTasks(tasks.map(t => t.id === task.id ? updated : t))
  }

  const handleStatusChange = (task: Task, status: TaskStatus) => {
    const updated = { ...task, status, updatedAt: new Date(), completedAt: status === 'DONE' ? new Date() : undefined }
    updateTasks(tasks.map(t => t.id === task.id ? updated : t))
  }

  const handleDateChange = (task: Task, dateStr: string) => {
    const updated = { ...task, dueDate: dateStr ? new Date(dateStr) : undefined, updatedAt: new Date() }
    updateTasks(tasks.map(t => t.id === task.id ? updated : t))
  }

  const doneTasks = tasks.filter(t => t.status === 'DONE').length
  const activeTasks = tasks.filter(t => !['DONE', 'CANCELLED'].includes(t.status)).length

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono font-bold" style={{ fontSize: 22, color: 'var(--color-text)' }}>Задачи</h1>
          {tasks.length > 0 && (
            <p className="font-sans mt-0.5" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              {activeTasks} активных · {doneTasks} завершено
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center rounded-lg p-1" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            {([
              { id: 'kanban', icon: LayoutGrid, label: 'Канбан' },
              { id: 'list', icon: List, label: 'Список' },
            ] as const).map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setViewMode(id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all duration-200 font-sans text-xs"
                style={{
                  background: viewMode === id ? 'var(--color-accent)' : 'transparent',
                  color: viewMode === id ? 'var(--color-bg)' : 'var(--color-text-muted)',
                  fontSize: 12,
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
          <Button variant="primary" size="md" onClick={() => setShowNewTask(true)}>
            <Plus size={14} />
            Новая задача
          </Button>
        </div>
      </div>

      {/* Content */}
      <motion.div key={viewMode} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
        {viewMode === 'kanban' ? (
          <KanbanBoard tasks={tasks} onTasksChange={updateTasks} onTaskClick={setSelectedTask} />
        ) : (
          <div className="rounded-lg overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            {/* Table header */}
            <div
              className="flex items-center px-4 gap-3"
              style={{ height: 40, borderBottom: '1px solid var(--color-border)', background: 'var(--color-elevated)' }}
            >
              {[
                { label: '', width: 36 },
                { label: 'ПРИОРИТЕТ', width: 110 },
                { label: 'ЗАДАЧА', flex: true },
                { label: 'ДЕДЛАЙН', width: 130 },
                { label: 'СТАТУС', width: 140 },
                { label: '', width: 28 },
              ].map(({ label, width, flex }, i) => (
                <div
                  key={i}
                  className="font-mono uppercase tracking-wide"
                  style={{ fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: '0.09em', flex: flex ? 1 : undefined, width, minWidth: width, flexShrink: flex ? undefined : 0 }}
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Rows */}
            {tasks.map((task) => {
              const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE'
              const isDone = task.status === 'DONE'
              return (
                <div
                  key={task.id}
                  className="flex items-center px-4 gap-3 cursor-pointer transition-all duration-150"
                  style={{ height: 52, borderBottom: '1px solid var(--color-border-subtle)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  onClick={() => setSelectedTask(task)}
                >
                  {/* Checkbox */}
                  <div style={{ width: 36, minWidth: 36, flexShrink: 0 }}>
                    <button
                      onClick={(e) => handleToggleDone(task, e)}
                      style={{
                        width: 20, height: 20, borderRadius: 5, cursor: 'pointer',
                        border: `1.5px solid ${isDone ? 'var(--color-success)' : 'var(--color-border)'}`,
                        background: isDone ? 'var(--color-success-dim)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {isDone && <Check size={11} style={{ color: 'var(--color-success)' }} />}
                    </button>
                  </div>

                  {/* Priority */}
                  <div style={{ width: 110, minWidth: 110, flexShrink: 0 }}>
                    <PriorityDropdown value={task.priority} onChange={(p) => handlePriorityChange(task, p)} />
                  </div>

                  {/* Title */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span
                      className="font-sans truncate block"
                      style={{ fontSize: 13, color: isDone ? 'var(--color-text-muted)' : 'var(--color-text)', textDecoration: isDone ? 'line-through' : 'none' }}
                    >
                      {task.title}
                    </span>
                    {task.subtasks && task.subtasks.length > 0 && (
                      <span className="font-mono" style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                        {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length} подзадач
                      </span>
                    )}
                  </div>

                  {/* Due date */}
                  <div style={{ width: 130, minWidth: 130, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="date"
                      value={task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''}
                      onChange={(e) => handleDateChange(task, e.target.value)}
                      className="font-mono rounded-md px-2 py-1 outline-none"
                      style={{
                        fontSize: 12, background: 'transparent', border: 'none',
                        color: isOverdue ? 'var(--color-danger)' : task.dueDate ? 'var(--color-text-secondary)' : 'var(--color-text-muted)',
                        colorScheme: 'dark', cursor: 'pointer', width: '100%',
                      }}
                    />
                  </div>

                  {/* Status */}
                  <div style={{ width: 140, minWidth: 140, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    <StatusDropdown value={task.status} onChange={(s) => handleStatusChange(task, s)} />
                  </div>

                  {/* Open arrow */}
                  <div style={{ width: 28, minWidth: 28, flexShrink: 0, color: 'var(--color-text-muted)', fontSize: 16, textAlign: 'center' }}>›</div>
                </div>
              )
            })}

            {tasks.length === 0 && (
              <div className="py-16 text-center space-y-3">
                <p className="font-mono" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Задач пока нет</p>
                <button
                  onClick={() => setShowNewTask(true)}
                  className="font-sans text-sm px-4 py-2 rounded-lg transition-all"
                  style={{ background: 'var(--color-accent-dim)', color: 'var(--color-accent)', border: '1px solid var(--color-accent)40', fontSize: 13 }}
                >
                  + Создать первую задачу
                </button>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Task drawer */}
      <TaskDrawer
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />

      {/* New task modal */}
      <AnimatePresence>
        {showNewTask && (
          <NewTaskModal onClose={() => setShowNewTask(false)} onCreate={handleCreate} />
        )}
      </AnimatePresence>
    </div>
  )
}
