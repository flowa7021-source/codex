'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { MOCK_USERS, MOCK_TASKS, MOCK_DOCUMENTS, WEEKLY_ACTIVITY } from '@/app/lib/mock-data'
import { Avatar } from '@/app/components/ui/Avatar'
import { StatusBadge } from '@/app/components/ui/StatusBadge'
import { BarChartMini } from '@/app/components/charts/BarChartMini'
import { DonutMini } from '@/app/components/charts/DonutMini'
import { ROLE_LABELS, ONLINE_STATUS_COLORS } from '@/app/lib/constants'
import { formatDate } from '@/app/lib/utils'

export default function TeamMemberPage() {
  const { id } = useParams()
  const user = MOCK_USERS.find(u => u.id === id)

  if (!user) {
    return (
      <div className="p-6 text-center" style={{ color: 'var(--color-text-muted)' }}>
        Сотрудник не найден
      </div>
    )
  }

  const userTasks = MOCK_TASKS.filter(t => t.assigneeId === user.id)
  const userDocs = MOCK_DOCUMENTS.filter(d => d.authorId === user.id)
  const doneTasks = userTasks.filter(t => t.status === 'DONE')
  const progress = userTasks.length > 0 ? Math.round((doneTasks.length / userTasks.length) * 100) : 0

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      {/* Back */}
      <Link
        href="/dashboard/team"
        className="flex items-center gap-2 font-sans text-sm"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <ArrowLeft size={16} />
        Назад к команде
      </Link>

      {/* Profile header */}
      <div
        className="rounded-lg p-6"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div className="flex items-start gap-6">
          <Avatar name={user.name} size={64} status={user.status} showStatus />
          <div className="flex-1">
            <h1 className="font-sans font-bold" style={{ fontSize: 22, color: 'var(--color-text)' }}>
              {user.name}
            </h1>
            <p className="font-sans mt-1" style={{ fontSize: 15, color: 'var(--color-text-muted)' }}>
              {user.position}
            </p>
            <div className="flex items-center gap-3 mt-3">
              <span
                className="font-mono text-xs px-2 py-0.5 rounded-sm"
                style={{ background: 'var(--color-accent-dim)', color: 'var(--color-accent)', fontSize: 11 }}
              >
                {ROLE_LABELS[user.role]}
              </span>
              <span className="font-mono text-xs" style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
                {user.email}
              </span>
            </div>
          </div>
          {/* KPI */}
          <div className="text-center">
            <DonutMini value={progress} max={100} size={56} />
            <div className="font-mono font-bold mt-2" style={{ fontSize: 18, color: 'var(--color-accent)' }}>
              {progress}%
            </div>
            <div className="font-mono" style={{ fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}>
              ПРОГРЕСС
            </div>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Всего задач', value: userTasks.length, color: 'var(--color-text)' },
          { label: 'Активных', value: userTasks.filter(t => t.status === 'ACTIVE').length, color: 'var(--color-info)' },
          { label: 'Завершено', value: doneTasks.length, color: 'var(--color-success)' },
          { label: 'Документов', value: userDocs.length, color: 'var(--color-accent)' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-lg p-4 text-center"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <div className="font-mono font-bold" style={{ fontSize: 28, color }}>{value}</div>
            <div className="font-mono uppercase mt-1" style={{ fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: '0.08em' }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Activity chart */}
      <div
        className="rounded-lg p-5"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <h2 className="font-mono font-semibold uppercase tracking-widest mb-4" style={{ fontSize: 11, color: 'var(--color-text-secondary)', letterSpacing: '0.1em' }}>
          АКТИВНОСТЬ ЗА НЕДЕЛЮ
        </h2>
        <BarChartMini data={WEEKLY_ACTIVITY.map(v => Math.round(v * Math.random()))} height={80} />
      </div>

      {/* Tasks */}
      <div
        className="rounded-lg overflow-hidden"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div className="p-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <h2 className="font-mono font-semibold uppercase tracking-widest" style={{ fontSize: 11, color: 'var(--color-text-secondary)', letterSpacing: '0.1em' }}>
            ЗАДАЧИ ({userTasks.length})
          </h2>
        </div>
        {userTasks.length === 0 ? (
          <div className="p-8 text-center font-sans text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Нет задач
          </div>
        ) : (
          userTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-4 px-4"
              style={{ height: 48, borderBottom: '1px solid var(--color-border-subtle)' }}
            >
              <div style={{ flex: 1 }}>
                <span className="font-sans text-sm" style={{ color: 'var(--color-text)' }}>{task.title}</span>
              </div>
              <StatusBadge type="task" status={task.status} />
              {task.dueDate && (
                <span className="font-mono text-xs" style={{ color: 'var(--color-text-muted)', width: 70, textAlign: 'right' }}>
                  {formatDate(task.dueDate)}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
