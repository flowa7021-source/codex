import type { DocumentStatus, TaskStatus, Priority, UserRole, OnlineStatus } from '@/app/types'

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  DRAFT: 'Черновик',
  ACTIVE: 'В работе',
  REVIEW: 'На проверке',
  APPROVED: 'Утверждён',
  REJECTED: 'Отклонён',
  ARCHIVED: 'В архиве',
}

export const DOCUMENT_STATUS_COLORS: Record<DocumentStatus, string> = {
  DRAFT: 'var(--color-text-muted)',
  ACTIVE: 'var(--color-info)',
  REVIEW: 'var(--color-accent)',
  APPROVED: 'var(--color-success)',
  REJECTED: 'var(--color-danger)',
  ARCHIVED: 'var(--color-text-secondary)',
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'Новые',
  ACTIVE: 'В работе',
  PENDING: 'Ожидание',
  REVIEW: 'На проверке',
  DONE: 'Завершено',
  CANCELLED: 'Отменено',
}

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  TODO: 'var(--color-text-muted)',
  ACTIVE: 'var(--color-info)',
  PENDING: 'var(--color-warning)',
  REVIEW: 'var(--color-accent)',
  DONE: 'var(--color-success)',
  CANCELLED: 'var(--color-text-secondary)',
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: 'Низкий',
  MEDIUM: 'Средний',
  HIGH: 'Высокий',
  URGENT: 'Срочный',
}

export const PRIORITY_COLORS: Record<Priority, string> = {
  LOW: 'var(--color-text-muted)',
  MEDIUM: 'var(--color-info)',
  HIGH: 'var(--color-warning)',
  URGENT: 'var(--color-danger)',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Администратор',
  MANAGER: 'Руководитель',
  LEAD: 'Ведущий специалист',
  SPECIALIST: 'Специалист',
}

export const ONLINE_STATUS_COLORS: Record<OnlineStatus, string> = {
  ONLINE: 'var(--color-success)',
  AWAY: 'var(--color-warning)',
  OFFLINE: 'var(--color-text-muted)',
}

export const KANBAN_COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'TODO', label: 'Новые', color: 'var(--color-text-muted)' },
  { id: 'ACTIVE', label: 'В работе', color: 'var(--color-info)' },
  { id: 'PENDING', label: 'Ожидание', color: 'var(--color-warning)' },
  { id: 'REVIEW', label: 'На проверке', color: 'var(--color-accent)' },
  { id: 'DONE', label: 'Завершено', color: 'var(--color-success)' },
]

export const DAYS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
