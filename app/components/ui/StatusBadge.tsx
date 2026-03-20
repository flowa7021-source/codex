'use client'

import { Badge } from './Badge'
import {
  DOCUMENT_STATUS_LABELS,
  TASK_STATUS_LABELS,
  PRIORITY_LABELS,
} from '@/app/lib/constants'
import type { DocumentStatus, TaskStatus, Priority } from '@/app/types'

type StatusBadgeProps =
  | { type: 'document'; status: DocumentStatus }
  | { type: 'task'; status: TaskStatus }
  | { type: 'priority'; status: Priority }

const documentVariants: Record<DocumentStatus, 'muted' | 'info' | 'accent' | 'success' | 'danger' | 'default'> = {
  DRAFT: 'muted',
  ACTIVE: 'info',
  REVIEW: 'accent',
  APPROVED: 'success',
  REJECTED: 'danger',
  ARCHIVED: 'default',
}

const taskVariants: Record<TaskStatus, 'muted' | 'info' | 'warning' | 'accent' | 'success' | 'default'> = {
  TODO: 'muted',
  ACTIVE: 'info',
  PENDING: 'warning',
  REVIEW: 'accent',
  DONE: 'success',
  CANCELLED: 'default',
}

const priorityVariants: Record<Priority, 'muted' | 'info' | 'warning' | 'danger'> = {
  LOW: 'muted',
  MEDIUM: 'info',
  HIGH: 'warning',
  URGENT: 'danger',
}

export function StatusBadge(props: StatusBadgeProps) {
  if (props.type === 'document') {
    return (
      <Badge variant={documentVariants[props.status] as any}>
        {DOCUMENT_STATUS_LABELS[props.status]}
      </Badge>
    )
  }
  if (props.type === 'task') {
    return (
      <Badge variant={taskVariants[props.status] as any}>
        {TASK_STATUS_LABELS[props.status]}
      </Badge>
    )
  }
  return (
    <Badge variant={priorityVariants[props.status] as any}>
      {PRIORITY_LABELS[props.status]}
    </Badge>
  )
}
