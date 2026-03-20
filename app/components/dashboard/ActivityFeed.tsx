'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { formatTime } from '@/app/lib/utils'
import type { ActivityLog } from '@/app/types'

const ACTION_LABELS: Record<string, { verb: string; prep?: string }> = {
  uploaded: { verb: 'загрузил(а)', prep: 'версию' },
  approved: { verb: 'утвердил(а)' },
  rejected: { verb: 'отклонил(а)' },
  commented: { verb: 'прокомментировал(а)' },
  status_changed: { verb: 'изменил(а) статус' },
  completed: { verb: 'завершил(а)' },
  created: { verb: 'создал(а)' },
}

interface ActivityFeedProps {
  activities: ActivityLog[]
}

function ActivityItem({ activity }: { activity: ActivityLog }) {
  const { user, action, document, task, details, createdAt } = activity
  const actionMeta = ACTION_LABELS[action] || { verb: action }

  let objectText = ''
  let parsedDetails: Record<string, string> = {}
  try { parsedDetails = JSON.parse(details || '{}') } catch {}

  if (document) {
    objectText = `[${document.number}]`
  } else if (task) {
    objectText = `[${task.title.slice(0, 30)}...]`
  } else if (parsedDetails.docNumber) {
    objectText = `[${parsedDetails.docNumber}]`
  } else if (parsedDetails.taskTitle) {
    objectText = `[${parsedDetails.taskTitle.slice(0, 30)}]`
  }

  const versionText = parsedDetails.version ? ` v${parsedDetails.version}` : ''

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-3 py-2.5"
      style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
    >
      <span
        className="font-mono flex-shrink-0 text-right"
        style={{ fontSize: 11, color: 'var(--color-text-muted)', width: 44, paddingTop: 1 }}
      >
        {formatTime(createdAt)}
      </span>
      <p className="font-sans text-xs leading-relaxed flex-1">
        <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>
          {user.name}
        </span>{' '}
        <span style={{ color: 'var(--color-text-secondary)' }}>
          {actionMeta.verb}
        </span>
        {objectText && (
          <>
            {' '}
            <span style={{ color: 'var(--color-accent)' }}>
              {objectText}{versionText}
            </span>
          </>
        )}
      </p>
    </motion.div>
  )
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <div
      className="rounded-lg p-4 h-full"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className="font-mono font-semibold uppercase tracking-widest"
          style={{ fontSize: 11, color: 'var(--color-text-secondary)', letterSpacing: '0.1em' }}
        >
          ЛЕНТА АКТИВНОСТИ
        </span>
      </div>
      <AnimatePresence>
        {activities.map((a) => (
          <ActivityItem key={a.id} activity={a} />
        ))}
      </AnimatePresence>
      {activities.length === 0 && (
        <div className="text-center py-8 font-sans text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Нет активности
        </div>
      )}
    </div>
  )
}
