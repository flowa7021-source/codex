'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, LayoutGrid, List } from 'lucide-react'
import { Button } from '@/app/components/ui/Button'
import { StatusBadge } from '@/app/components/ui/StatusBadge'
import { Avatar } from '@/app/components/ui/Avatar'
import { KanbanBoard } from '@/app/components/tasks/KanbanBoard'
import { MOCK_TASKS } from '@/app/lib/mock-data'
import { formatDate } from '@/app/lib/utils'
import type { Task } from '@/app/types'

type ViewMode = 'kanban' | 'list'

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS)
  const [viewMode, setViewMode] = useState<ViewMode>('kanban')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-mono font-bold" style={{ fontSize: 22, color: 'var(--color-text)' }}>
          Задачи
        </h1>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div
            className="flex items-center rounded-lg p-1"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
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
          <Button variant="primary" size="md">
            <Plus size={14} />
            Новая задача
          </Button>
        </div>
      </div>

      {/* Content */}
      <motion.div
        key={viewMode}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {viewMode === 'kanban' ? (
          <KanbanBoard
            tasks={tasks}
            onTasksChange={setTasks}
            onTaskClick={setSelectedTask}
          />
        ) : (
          <div
            className="rounded-lg overflow-hidden"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            {/* Table header */}
            <div
              className="flex items-center px-4 gap-4"
              style={{
                height: 40,
                borderBottom: '1px solid var(--color-border)',
                background: 'var(--color-elevated)',
              }}
            >
              {[
                { label: '—', width: 32 },
                { label: 'ПРИОРИТЕТ', width: 80 },
                { label: 'ЗАДАЧА', flex: true },
                { label: 'ИСПОЛНИТЕЛЬ', width: 160 },
                { label: 'ДЕДЛАЙН', width: 100 },
                { label: 'СТАТУС', width: 120 },
              ].map(({ label, width, flex }) => (
                <div
                  key={label}
                  className="font-mono uppercase tracking-wide"
                  style={{
                    fontSize: 11,
                    color: 'var(--color-text-muted)',
                    letterSpacing: '0.08em',
                    flex: flex ? 1 : undefined,
                    width,
                    minWidth: width,
                    flexShrink: flex ? undefined : 0,
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
            {tasks.map((task) => {
              const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE'
              return (
                <div
                  key={task.id}
                  className="flex items-center px-4 gap-4 cursor-pointer transition-all duration-150"
                  style={{ height: 48, borderBottom: '1px solid var(--color-border-subtle)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  onClick={() => setSelectedTask(task)}
                >
                  {/* Checkbox */}
                  <div style={{ width: 32, minWidth: 32 }}>
                    <div
                      style={{
                        width: 18, height: 18, borderRadius: 4,
                        border: `1.5px solid ${task.status === 'DONE' ? 'var(--color-success)' : 'var(--color-border)'}`,
                        background: task.status === 'DONE' ? 'var(--color-success-dim)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {task.status === 'DONE' && (
                        <span style={{ color: 'var(--color-success)', fontSize: 10 }}>✓</span>
                      )}
                    </div>
                  </div>
                  {/* Priority */}
                  <div style={{ width: 80, minWidth: 80 }}>
                    <StatusBadge type="priority" status={task.priority} />
                  </div>
                  {/* Title */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span
                      className="font-sans truncate block"
                      style={{
                        fontSize: 13,
                        color: task.status === 'DONE' ? 'var(--color-text-muted)' : 'var(--color-text)',
                        textDecoration: task.status === 'DONE' ? 'line-through' : 'none',
                      }}
                    >
                      {task.title}
                    </span>
                  </div>
                  {/* Assignee */}
                  <div style={{ width: 160, minWidth: 160 }}>
                    {task.assignee && (
                      <div className="flex items-center gap-2">
                        <Avatar name={task.assignee.name} size={20} />
                        <span className="font-sans truncate" style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                          {task.assignee.name}
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Deadline */}
                  <div style={{ width: 100, minWidth: 100 }}>
                    {task.dueDate && (
                      <span
                        className="font-mono"
                        style={{
                          fontSize: 12,
                          color: isOverdue ? 'var(--color-danger)' : 'var(--color-text-muted)',
                        }}
                      >
                        {formatDate(task.dueDate)}
                      </span>
                    )}
                  </div>
                  {/* Status */}
                  <div style={{ width: 120, minWidth: 120 }}>
                    <StatusBadge type="task" status={task.status} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </motion.div>
    </div>
  )
}
