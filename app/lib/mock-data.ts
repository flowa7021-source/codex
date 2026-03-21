import type { User, Document, Task, ActivityLog, DailyMetric } from '@/app/types'

export const MOCK_USERS: User[] = [
  {
    id: 'u1', email: 'krot@nexus.ru', name: 'Крот',
    role: 'MANAGER', position: 'Оперативный командир', status: 'ONLINE',
    createdAt: new Date('2024-01-01'), updatedAt: new Date(),
  },
]

export const MOCK_CATEGORIES = [
  { id: 'c1', name: 'Должностные инструкции', code: 'ДИ', color: '#60A5FA' },
  { id: 'c2', name: 'Акты проверок', code: 'АП', color: '#4ADE80' },
  { id: 'c3', name: 'Графики ТО', code: 'ГТО', color: '#FBBF24' },
  { id: 'c4', name: 'Приказы', code: 'ПР', color: '#F87171' },
  { id: 'c5', name: 'Справки', code: 'СП', color: '#D4A054' },
]

export const MOCK_DOCUMENTS: Document[] = []

export const MOCK_TASKS: Task[] = []

export const MOCK_ACTIVITY: ActivityLog[] = []

export const MOCK_DAILY_METRICS: DailyMetric[] = Array.from({ length: 14 }, (_, i) => {
  const date = new Date()
  date.setDate(date.getDate() - (13 - i))
  return {
    id: `m${i}`,
    date,
    documentsCreated: 0,
    documentsCompleted: 0,
    tasksCreated: 0,
    tasksCompleted: 0,
    avgProcessingHours: 0,
    activeUsers: 1,
  }
})

export const WEEKLY_ACTIVITY = [0, 0, 0, 0, 0, 0, 0]

export const MOCK_METRICS = {
  documentsInProgress: 0,
  documentsTotal: 0,
  tasksCompletedThisWeek: 0,
  totalTasksThisWeek: 0,
  teamOnline: 1,
  teamTotal: 1,
  avgKpi: 0,
  deltas: {
    documents: 0,
    tasks: 0,
    team: 0,
    kpi: 0,
  },
  sparklines: {
    documents: [0, 0, 0, 0, 0, 0, 0],
    tasks: [0, 0, 0, 0, 0, 0, 0],
    team: [1, 1, 1, 1, 1, 1, 1],
    kpi: [0, 0, 0, 0, 0, 0, 0],
  },
}
