'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Trash2, Plus, Check } from 'lucide-react'
import { toast } from 'sonner'
import type { Task, TaskStatus, Priority } from '@/app/types'
import { Button } from '@/app/components/ui/Button'
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS } from '@/app/lib/constants'

interface TaskDrawerProps {
  task: Task | null
  onClose: () => void
  onUpdate: (task: Task) => void
  onDelete: (taskId: string) => void
}

const STATUSES: TaskStatus[] = ['TODO', 'ACTIVE', 'PENDING', 'REVIEW', 'DONE']
const PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

export function TaskDrawer({ task, onClose, onUpdate, onDelete }: TaskDrawerProps) {
  const [edited, setEdited] = useState<Task | null>(null)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [newSubtask, setNewSubtask] = useState('')

  useEffect(() => {
    setEdited(task ? { ...task } : null)
    setIsEditingTitle(false)
    setNewSubtask('')
  }, [task])

  if (!edited) return null

  const push = (changes: Partial<Task>) => {
    const updated = { ...edited, ...changes, updatedAt: new Date() }
    setEdited(updated)
    onUpdate(updated)
  }

  const handleToggleSubtask = (id: string) => {
    push({
      subtasks: (edited.subtasks ?? []).map(s =>
        s.id === id ? { ...s, completed: !s.completed } : s
      ),
    })
  }

  const handleDeleteSubtask = (id: string) => {
    push({ subtasks: (edited.subtasks ?? []).filter(s => s.id !== id) })
  }

  const handleAddSubtask = () => {
    const title = newSubtask.trim()
    if (!title) return
    push({
      subtasks: [
        ...(edited.subtasks ?? []),
        { id: `st-${Date.now()}`, title, completed: false, order: edited.subtasks?.length ?? 0, taskId: edited.id },
      ],
    })
    setNewSubtask('')
  }

  const handleDelete = () => {
    onDelete(edited.id)
    toast.success('Задача удалена')
    onClose()
  }

  const completedCount = (edited.subtasks ?? []).filter(s => s.completed).length
  const totalCount = edited.subtasks?.length ?? 0

  return (
    <AnimatePresence>
      {task && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.35)' }}
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ duration: 0.28, ease: [0, 0, 0.2, 1] }}
            className="fixed right-0 top-0 bottom-0 z-50 flex flex-col"
            style={{ width: 460, background: 'var(--color-surface)', borderLeft: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lg)' }}
          >
            {/* Header */}
            <div className="flex items-start gap-3 p-5" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <div className="flex-1 min-w-0">
                {isEditingTitle ? (
                  <textarea
                    autoFocus
                    value={edited.title}
                    rows={2}
                    onChange={(e) => setEdited(t => t ? { ...t, title: e.target.value } : t)}
                    onBlur={() => { setIsEditingTitle(false); onUpdate({ ...edited }) }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        setIsEditingTitle(false)
                        onUpdate({ ...edited })
                      }
                    }}
                    className="w-full bg-transparent outline-none font-sans font-semibold resize-none"
                    style={{ fontSize: 17, lineHeight: 1.45, color: 'var(--color-text)', border: 'none', padding: 0 }}
                  />
                ) : (
                  <h2
                    className="font-sans font-semibold cursor-text"
                    style={{ fontSize: 17, lineHeight: 1.45, color: 'var(--color-text)' }}
                    onClick={() => setIsEditingTitle(true)}
                    title="Нажмите, чтобы редактировать"
                  >
                    {edited.title}
                  </h2>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-md transition-all flex-shrink-0"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <X size={15} />
              </button>
            </div>

            {/* Status */}
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <p className="font-mono mb-2.5" style={{ fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: '0.1em' }}>СТАТУС</p>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map(s => (
                  <button
                    key={s}
                    onClick={() => push({ status: s, ...(s === 'DONE' ? { completedAt: new Date() } : { completedAt: undefined }) })}
                    className="px-3 py-1.5 rounded-md font-mono transition-all"
                    style={{
                      fontSize: 11,
                      background: edited.status === s ? `${TASK_STATUS_COLORS[s]}20` : 'var(--color-elevated)',
                      color: edited.status === s ? TASK_STATUS_COLORS[s] : 'var(--color-text-muted)',
                      border: `1px solid ${edited.status === s ? TASK_STATUS_COLORS[s] : 'var(--color-border)'}`,
                    }}
                  >
                    {TASK_STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority + Due date */}
            <div className="grid grid-cols-2 gap-5 px-5 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <div>
                <p className="font-mono mb-2.5" style={{ fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: '0.1em' }}>ПРИОРИТЕТ</p>
                <div className="flex flex-col gap-1">
                  {PRIORITIES.map(p => (
                    <button
                      key={p}
                      onClick={() => push({ priority: p })}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all text-left"
                      style={{
                        background: edited.priority === p ? `${PRIORITY_COLORS[p]}15` : 'transparent',
                        border: `1px solid ${edited.priority === p ? PRIORITY_COLORS[p] : 'transparent'}`,
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_COLORS[p], display: 'block', flexShrink: 0 }} />
                      <span className="font-mono" style={{ fontSize: 12, color: edited.priority === p ? PRIORITY_COLORS[p] : 'var(--color-text-secondary)' }}>
                        {PRIORITY_LABELS[p]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-mono mb-2.5" style={{ fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: '0.1em' }}>ДЕДЛАЙН</p>
                <input
                  type="date"
                  value={edited.dueDate ? new Date(edited.dueDate).toISOString().split('T')[0] : ''}
                  onChange={(e) => push({ dueDate: e.target.value ? new Date(e.target.value) : undefined })}
                  className="w-full rounded-lg px-3 py-2.5 font-mono outline-none"
                  style={{
                    background: 'var(--color-elevated)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    fontSize: 12,
                    colorScheme: 'dark',
                  }}
                />
                {edited.dueDate && (
                  <button
                    onClick={() => push({ dueDate: undefined })}
                    className="mt-1.5 font-mono"
                    style={{ fontSize: 11, color: 'var(--color-text-muted)' }}
                  >
                    × убрать дату
                  </button>
                )}

                {/* Description */}
                <p className="font-mono mt-4 mb-2.5" style={{ fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: '0.1em' }}>ОПИСАНИЕ</p>
                <textarea
                  value={edited.description ?? ''}
                  onChange={(e) => push({ description: e.target.value })}
                  placeholder="Добавить описание..."
                  rows={3}
                  className="w-full rounded-lg px-3 py-2 font-sans outline-none resize-none"
                  style={{
                    background: 'var(--color-elevated)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    fontSize: 12,
                  }}
                />
              </div>
            </div>

            {/* Subtasks */}
            <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
              <p className="font-mono mb-2.5" style={{ fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: '0.1em' }}>
                ПОДЗАДАЧИ {totalCount > 0 && `${completedCount} / ${totalCount}`}
              </p>

              {totalCount > 0 && (
                <div style={{ height: 3, borderRadius: 2, background: 'var(--color-border)', overflow: 'hidden', marginBottom: 14 }}>
                  <div style={{ height: '100%', width: `${(completedCount / totalCount) * 100}%`, background: 'var(--color-accent)', borderRadius: 2, transition: 'width 0.4s ease' }} />
                </div>
              )}

              <div className="space-y-1.5 mb-4">
                {(edited.subtasks ?? []).map(sub => (
                  <div
                    key={sub.id}
                    className="group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
                    style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}
                  >
                    <button
                      onClick={() => handleToggleSubtask(sub.id)}
                      style={{
                        width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                        border: `1.5px solid ${sub.completed ? 'var(--color-success)' : 'var(--color-border)'}`,
                        background: sub.completed ? 'var(--color-success-dim)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                      }}
                    >
                      {sub.completed && <Check size={10} style={{ color: 'var(--color-success)' }} />}
                    </button>
                    <span
                      className="font-sans flex-1"
                      style={{
                        fontSize: 13,
                        color: sub.completed ? 'var(--color-text-muted)' : 'var(--color-text)',
                        textDecoration: sub.completed ? 'line-through' : 'none',
                        cursor: 'default',
                      }}
                    >
                      {sub.title}
                    </span>
                    <button
                      onClick={() => handleDeleteSubtask(sub.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: 'var(--color-text-muted)', padding: 2 }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-danger)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-muted)'}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <input
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
                  placeholder="Новая подзадача..."
                  className="flex-1 px-3 py-2.5 rounded-lg font-sans outline-none"
                  style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: 13 }}
                />
                <button
                  onClick={handleAddSubtask}
                  className="p-2.5 rounded-lg transition-all"
                  style={{ background: 'var(--color-accent-dim)', border: '1px solid var(--color-accent)', color: 'var(--color-accent)' }}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-3 p-4" style={{ borderTop: '1px solid var(--color-border)' }}>
              <button
                onClick={handleDelete}
                className="p-2.5 rounded-md transition-all"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-danger)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-danger-dim)'; e.currentTarget.style.borderColor = 'var(--color-danger)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--color-border)' }}
                title="Удалить задачу"
              >
                <Trash2 size={14} />
              </button>
              <Button variant="primary" className="flex-1" onClick={onClose}>
                Готово
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
