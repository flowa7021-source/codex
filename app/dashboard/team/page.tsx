'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Avatar } from '@/app/components/ui/Avatar'
import { DonutMini } from '@/app/components/charts/DonutMini'
import { ONLINE_STATUS_COLORS, ROLE_LABELS } from '@/app/lib/constants'
import type { User, Task } from '@/app/types'

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as any } },
}

const STATUS_LABELS: Record<string, string> = {
  ONLINE: 'Онлайн',
  AWAY: 'Нет на месте',
  OFFLINE: 'Офлайн',
}

type UserWithTasks = User & { assignedTasks: Task[] }

export default function TeamPage() {
  const [users, setUsers] = useState<UserWithTasks[]>([])

  useEffect(() => {
    window.electronAPI.getTeam().then(setUsers).catch(console.error)
  }, [])

  const onlineCount = users.filter(u => u.status === 'ONLINE').length

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="font-mono font-bold" style={{ fontSize: 22, color: 'var(--color-text)' }}>
          Команда
        </h1>
        <p className="font-sans mt-1" style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>
          {onlineCount} из {users.length} онлайн
        </p>
      </div>

      {/* Team grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid gap-4"
        style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}
      >
        {users.map((user) => {
          const userTasks = user.assignedTasks ?? []
          const activeTasks = userTasks.filter(t => ['TODO', 'ACTIVE', 'PENDING', 'REVIEW'].includes(t.status))
          const doneTasks = userTasks.filter(t => t.status === 'DONE')
          const progress = userTasks.length > 0 ? Math.round((doneTasks.length / userTasks.length) * 100) : 0

          return (
            <motion.div key={user.id} variants={cardVariants}>
              <Link href={`/dashboard/team/member?id=${user.id}`}>
                <div
                  className="rounded-lg p-5 cursor-pointer transition-all duration-200"
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--color-surface-hover)'
                    e.currentTarget.style.borderColor = 'var(--color-accent)/30'
                    e.currentTarget.style.boxShadow = 'var(--shadow-glow)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--color-surface)'
                    e.currentTarget.style.borderColor = 'var(--color-border)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  {/* Top section */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className="relative">
                      <div
                        className="flex items-center justify-center rounded-full font-mono font-semibold"
                        style={{
                          width: 48, height: 48,
                          background: 'var(--color-accent-dim)',
                          color: 'var(--color-accent)',
                          fontSize: 16,
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        {user.name.split(' ').slice(0, 2).map(n => n[0]).join('')}
                      </div>
                      <span
                        style={{
                          width: 12, height: 12,
                          borderRadius: '50%',
                          background: ONLINE_STATUS_COLORS[user.status],
                          border: '2px solid var(--color-surface)',
                          position: 'absolute',
                          bottom: 0, right: 0,
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-sans font-semibold truncate" style={{ fontSize: 15, color: 'var(--color-text)' }}>
                        {user.name}
                      </div>
                      <div className="font-sans truncate mt-0.5" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                        {user.position}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span
                          style={{
                            width: 6, height: 6,
                            borderRadius: '50%',
                            background: ONLINE_STATUS_COLORS[user.status],
                            display: 'block',
                          }}
                        />
                        <span className="font-mono" style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                          {STATUS_LABELS[user.status] ?? user.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Role badge */}
                  <div className="mb-4">
                    <span
                      className="font-mono text-xs px-2 py-0.5 rounded-sm"
                      style={{
                        fontSize: 11,
                        background: 'var(--color-accent-dim)',
                        color: 'var(--color-accent)',
                      }}
                    >
                      {ROLE_LABELS[user.role]}
                    </span>
                  </div>

                  {/* Stats */}
                  <div
                    className="flex items-center"
                    style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 12 }}
                  >
                    <div className="flex-1 text-center">
                      <div className="font-mono font-bold" style={{ fontSize: 20, color: 'var(--color-text)' }}>
                        {activeTasks.length}
                      </div>
                      <div className="font-mono uppercase" style={{ fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: '0.05em', marginTop: 2 }}>
                        Активных
                      </div>
                    </div>
                    <div className="flex-1 text-center">
                      <div className="font-mono font-bold" style={{ fontSize: 20, color: 'var(--color-success)' }}>
                        {doneTasks.length}
                      </div>
                      <div className="font-mono uppercase" style={{ fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: '0.05em', marginTop: 2 }}>
                        Завершено
                      </div>
                    </div>
                    <div className="flex-1 flex justify-center">
                      <div className="relative">
                        <DonutMini value={progress} max={100} size={40} />
                        <div
                          className="absolute inset-0 flex items-center justify-center font-mono"
                          style={{ fontSize: 9, color: 'var(--color-accent)' }}
                        >
                          {progress}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          )
        })}

        {users.length === 0 && (
          <div
            className="col-span-3 text-center py-12 font-sans"
            style={{ fontSize: 14, color: 'var(--color-text-muted)' }}
          >
            Загрузка...
          </div>
        )}
      </motion.div>
    </div>
  )
}
