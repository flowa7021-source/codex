'use client'

import { useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { motion } from 'framer-motion'
import { KANBAN_COLUMNS, TASK_STATUS_COLORS } from '@/app/lib/constants'
import type { Task, TaskStatus } from '@/app/types'
import { Avatar } from '@/app/components/ui/Avatar'
import { formatDate } from '@/app/lib/utils'
import { PRIORITY_COLORS } from '@/app/lib/constants'

interface TaskCardProps {
  task: Task
  overlay?: boolean
  onClick?: (task: Task) => void
}

function TaskCard({ task, overlay, onClick }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !!overlay,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE'
  const completedSubtasks = task.subtasks?.filter(s => s.completed).length ?? 0
  const totalSubtasks = task.subtasks?.length ?? 0

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="p-3.5 rounded-lg cursor-grab active:cursor-grabbing transition-all duration-150"
      onClick={() => onClick?.(task)}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
        e.currentTarget.style.borderColor = 'var(--color-border)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.borderColor = 'var(--color-border-subtle)'
      }}
    >
      <div
        style={{
          background: overlay ? 'var(--color-elevated)' : 'var(--color-surface)',
          border: `1px solid var(--color-border-subtle)`,
          borderRadius: 10,
          padding: 14,
          boxShadow: overlay ? 'var(--shadow-lg)' : undefined,
        }}
      >
        {/* Title */}
        <p className="font-sans" style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.4, marginBottom: 8 }}>
          {task.title}
        </p>

        {/* Subtasks progress */}
        {totalSubtasks > 0 && (
          <div className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono" style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                {completedSubtasks}/{totalSubtasks}
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
              <div
                style={{
                  height: '100%',
                  width: `${(completedSubtasks / totalSubtasks) * 100}%`,
                  background: 'var(--color-accent)',
                  borderRadius: 2,
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {task.assignee && (
              <Avatar name={task.assignee.name} size={20} />
            )}
            {task.assignee && (
              <span className="font-sans" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                {task.assignee.name.split(' ')[0]}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Priority dot */}
            <span
              style={{
                width: 6, height: 6, borderRadius: '50%',
                background: PRIORITY_COLORS[task.priority],
                display: 'block',
              }}
            />
            {/* Deadline */}
            {task.dueDate && (
              <span
                className="font-mono"
                style={{
                  fontSize: 11,
                  color: isOverdue ? 'var(--color-danger)' : 'var(--color-text-muted)',
                }}
              >
                {formatDate(task.dueDate, 'dd.MM')}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function KanbanColumn({
  id,
  label,
  color,
  tasks,
  onTaskClick,
}: {
  id: TaskStatus
  label: string
  color: string
  tasks: Task[]
  onTaskClick: (task: Task) => void
}) {
  return (
    <div
      className="flex flex-col flex-shrink-0"
      style={{ width: 260 }}
    >
      {/* Column header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 mb-2 rounded-lg"
        style={{
          borderTop: `2px solid ${color}`,
          background: 'var(--color-surface)',
          border: `1px solid var(--color-border)`,
          borderTopColor: color,
          borderTopWidth: 2,
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="font-mono font-semibold uppercase"
            style={{ fontSize: 12, color, letterSpacing: '0.08em' }}
          >
            {label}
          </span>
          <span
            className="font-mono font-semibold px-1.5 py-0.5 rounded-sm"
            style={{
              fontSize: 11,
              color,
              background: `${color}22`,
            }}
          >
            {tasks.length}
          </span>
        </div>
        <button
          className="p-1 rounded transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-muted)'}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Cards */}
      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-1 min-h-[100px] flex-1">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={onTaskClick} />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}

interface KanbanBoardProps {
  tasks: Task[]
  onTasksChange: (tasks: Task[]) => void
  onTaskClick: (task: Task) => void
}

export function KanbanBoard({ tasks, onTasksChange, onTaskClick }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const getTasksByStatus = (status: TaskStatus) =>
    tasks.filter(t => t.status === status).sort((a, b) => a.order - b.order)

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id)
    if (task) setActiveTask(task)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)

    if (!over) return

    const activeTask = tasks.find(t => t.id === active.id)
    if (!activeTask) return

    // Find the column (status) that the card was dropped onto
    let targetStatus: TaskStatus | undefined
    for (const col of KANBAN_COLUMNS) {
      const colTasks = getTasksByStatus(col.id)
      if (colTasks.some(t => t.id === over.id) || over.id === col.id) {
        targetStatus = col.id
        break
      }
    }

    if (!targetStatus || targetStatus === activeTask.status) return

    const newTasks = tasks.map(t =>
      t.id === activeTask.id ? { ...t, status: targetStatus! } : t
    )
    onTasksChange(newTasks)
    toast.success(`Задача перемещена в "${KANBAN_COLUMNS.find(c => c.id === targetStatus)?.label}"`)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin"
        style={{ minHeight: 500 }}
      >
        {KANBAN_COLUMNS.map(({ id, label, color }) => (
          <KanbanColumn
            key={id}
            id={id}
            label={label}
            color={color}
            tasks={getTasksByStatus(id)}
            onTaskClick={onTaskClick}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask && <TaskCard task={activeTask} overlay />}
      </DragOverlay>
    </DndContext>
  )
}
