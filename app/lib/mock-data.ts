import type { User, Document, Task, ActivityLog, DailyMetric } from '@/app/types'

export const MOCK_USERS: User[] = [
  {
    id: 'u1', email: 'salakhutdinov@umit.ru', name: 'Салахутдинов М.М.',
    role: 'MANAGER', position: 'Начальник УМиТ', status: 'ONLINE',
    createdAt: new Date('2024-01-01'), updatedAt: new Date(),
  },
  {
    id: 'u2', email: 'kozlova@umit.ru', name: 'Козлова Е.Н.',
    role: 'LEAD', position: 'Ведущий инженер', status: 'ONLINE',
    createdAt: new Date('2024-01-05'), updatedAt: new Date(),
  },
  {
    id: 'u3', email: 'petrov@umit.ru', name: 'Петров А.С.',
    role: 'SPECIALIST', position: 'Инженер по ТО', status: 'AWAY',
    createdAt: new Date('2024-02-10'), updatedAt: new Date(),
  },
  {
    id: 'u4', email: 'ivanova@umit.ru', name: 'Иванова О.В.',
    role: 'SPECIALIST', position: 'Специалист по документообороту', status: 'ONLINE',
    createdAt: new Date('2024-01-20'), updatedAt: new Date(),
  },
  {
    id: 'u5', email: 'morozov@umit.ru', name: 'Морозов Д.И.',
    role: 'LEAD', position: 'Ведущий слесарь-ремонтник', status: 'OFFLINE',
    createdAt: new Date('2023-11-15'), updatedAt: new Date(),
  },
  {
    id: 'u6', email: 'smirnova@umit.ru', name: 'Смирнова Т.А.',
    role: 'SPECIALIST', position: 'Техник по обслуживанию', status: 'ONLINE',
    createdAt: new Date('2024-03-01'), updatedAt: new Date(),
  },
]

export const MOCK_CATEGORIES = [
  { id: 'c1', name: 'Должностные инструкции', code: 'ДИ', color: '#60A5FA' },
  { id: 'c2', name: 'Акты проверок', code: 'АП', color: '#4ADE80' },
  { id: 'c3', name: 'Графики ТО', code: 'ГТО', color: '#FBBF24' },
  { id: 'c4', name: 'Приказы', code: 'ПР', color: '#F87171' },
  { id: 'c5', name: 'Справки', code: 'СП', color: '#D4A054' },
]

export const MOCK_DOCUMENTS: Document[] = [
  {
    id: 'd1', number: 'ДИ-047',
    title: 'Должностная инструкция слесаря-ремонтника (консолидация)',
    description: 'Консолидированная должностная инструкция для слесарей-ремонтников 3-5 разрядов',
    status: 'REVIEW', priority: 'HIGH', version: 3,
    authorId: 'u2', author: MOCK_USERS[1],
    categoryId: 'c1', category: MOCK_CATEGORIES[0],
    createdAt: new Date('2026-03-10'), updatedAt: new Date('2026-03-18'),
    dueDate: new Date('2026-03-22'),
  },
  {
    id: 'd2', number: 'АП-031',
    title: 'Акт проверки технического состояния оборудования цех №3',
    description: 'Плановая проверка состояния оборудования за Q1 2026',
    status: 'APPROVED', priority: 'MEDIUM', version: 1,
    authorId: 'u3', author: MOCK_USERS[2],
    categoryId: 'c2', category: MOCK_CATEGORIES[1],
    createdAt: new Date('2026-03-05'), updatedAt: new Date('2026-03-15'),
    dueDate: new Date('2026-03-15'),
  },
  {
    id: 'd3', number: 'ГТО-012',
    title: 'График планово-предупредительного технического обслуживания',
    description: 'Годовой график ТО на 2026 год',
    status: 'ACTIVE', priority: 'URGENT', version: 2,
    authorId: 'u1', author: MOCK_USERS[0],
    categoryId: 'c3', category: MOCK_CATEGORIES[2],
    createdAt: new Date('2026-01-15'), updatedAt: new Date('2026-03-01'),
    dueDate: new Date('2026-04-01'),
  },
  {
    id: 'd4', number: 'ПР-008',
    title: 'Приказ об организации дежурства в праздничные дни',
    status: 'DRAFT', priority: 'LOW', version: 1,
    authorId: 'u1', author: MOCK_USERS[0],
    categoryId: 'c4', category: MOCK_CATEGORIES[3],
    createdAt: new Date('2026-03-19'), updatedAt: new Date('2026-03-19'),
  },
  {
    id: 'd5', number: 'СП-022',
    title: 'Справка о состоянии технических ресурсов подразделения',
    status: 'REVIEW', priority: 'MEDIUM', version: 1,
    authorId: 'u4', author: MOCK_USERS[3],
    categoryId: 'c5', category: MOCK_CATEGORIES[4],
    createdAt: new Date('2026-03-14'), updatedAt: new Date('2026-03-18'),
    dueDate: new Date('2026-03-21'),
  },
  {
    id: 'd6', number: 'ДИ-046',
    title: 'Должностная инструкция техника по обслуживанию',
    status: 'APPROVED', priority: 'MEDIUM', version: 2,
    authorId: 'u2', author: MOCK_USERS[1],
    categoryId: 'c1', category: MOCK_CATEGORIES[0],
    createdAt: new Date('2026-02-20'), updatedAt: new Date('2026-03-10'),
  },
  {
    id: 'd7', number: 'АП-030',
    title: 'Акт проверки инструментального хозяйства',
    status: 'REJECTED', priority: 'HIGH', version: 1,
    authorId: 'u3', author: MOCK_USERS[2],
    categoryId: 'c2', category: MOCK_CATEGORIES[1],
    createdAt: new Date('2026-03-08'), updatedAt: new Date('2026-03-16'),
    dueDate: new Date('2026-03-15'),
  },
  {
    id: 'd8', number: 'ГТО-011',
    title: 'График аварийно-восстановительных работ',
    status: 'ARCHIVED', priority: 'LOW', version: 5,
    authorId: 'u5', author: MOCK_USERS[4],
    categoryId: 'c3', category: MOCK_CATEGORIES[2],
    createdAt: new Date('2025-12-01'), updatedAt: new Date('2026-01-15'),
  },
  {
    id: 'd9', number: 'ДИ-045',
    title: 'Должностная инструкция начальника смены',
    status: 'ACTIVE', priority: 'HIGH', version: 1,
    authorId: 'u1', author: MOCK_USERS[0],
    categoryId: 'c1', category: MOCK_CATEGORIES[0],
    createdAt: new Date('2026-03-12'), updatedAt: new Date('2026-03-17'),
    dueDate: new Date('2026-03-28'),
  },
  {
    id: 'd10', number: 'СП-021',
    title: 'Справка по итогам работы за февраль 2026',
    status: 'APPROVED', priority: 'LOW', version: 1,
    authorId: 'u4', author: MOCK_USERS[3],
    categoryId: 'c5', category: MOCK_CATEGORIES[4],
    createdAt: new Date('2026-03-03'), updatedAt: new Date('2026-03-07'),
  },
]

export const MOCK_TASKS: Task[] = [
  {
    id: 't1', title: 'Согласовать ДИ-047 с отделом кадров',
    description: 'Получить подписи согласующих лиц',
    status: 'REVIEW', priority: 'HIGH', order: 0,
    assigneeId: 'u2', assignee: MOCK_USERS[1],
    creatorId: 'u1', creator: MOCK_USERS[0],
    documentId: 'd1',
    createdAt: new Date('2026-03-15'), updatedAt: new Date('2026-03-18'),
    dueDate: new Date('2026-03-22'),
    subtasks: [
      { id: 'st1', title: 'Отправить на проверку', completed: true, order: 0, taskId: 't1' },
      { id: 'st2', title: 'Получить ответ от ОК', completed: false, order: 1, taskId: 't1' },
    ],
  },
  {
    id: 't2', title: 'Провести плановое ТО насосного агрегата №4',
    status: 'ACTIVE', priority: 'URGENT', order: 0,
    assigneeId: 'u3', assignee: MOCK_USERS[2],
    creatorId: 'u1', creator: MOCK_USERS[0],
    createdAt: new Date('2026-03-17'), updatedAt: new Date('2026-03-19'),
    dueDate: new Date('2026-03-21'),
    subtasks: [
      { id: 'st3', title: 'Подготовить инструмент', completed: true, order: 0, taskId: 't2' },
      { id: 'st4', title: 'Слить масло', completed: true, order: 1, taskId: 't2' },
      { id: 'st5', title: 'Заменить фильтры', completed: false, order: 2, taskId: 't2' },
    ],
  },
  {
    id: 't3', title: 'Подготовить отчёт по итогам Q1',
    status: 'TODO', priority: 'MEDIUM', order: 0,
    assigneeId: 'u4', assignee: MOCK_USERS[3],
    creatorId: 'u1', creator: MOCK_USERS[0],
    createdAt: new Date('2026-03-18'), updatedAt: new Date('2026-03-18'),
    dueDate: new Date('2026-03-31'),
  },
  {
    id: 't4', title: 'Обновить план закупок запчастей',
    status: 'PENDING', priority: 'HIGH', order: 0,
    assigneeId: 'u5', assignee: MOCK_USERS[4],
    creatorId: 'u1', creator: MOCK_USERS[0],
    createdAt: new Date('2026-03-10'), updatedAt: new Date('2026-03-15'),
    dueDate: new Date('2026-03-18'),
  },
  {
    id: 't5', title: 'Провести инструктаж по ТБ новых сотрудников',
    status: 'DONE', priority: 'MEDIUM', order: 0,
    assigneeId: 'u2', assignee: MOCK_USERS[1],
    creatorId: 'u1', creator: MOCK_USERS[0],
    createdAt: new Date('2026-03-12'), updatedAt: new Date('2026-03-14'),
    completedAt: new Date('2026-03-14'),
    dueDate: new Date('2026-03-14'),
  },
  {
    id: 't6', title: 'Разработать регламент аварийных остановок',
    status: 'ACTIVE', priority: 'HIGH', order: 1,
    assigneeId: 'u1', assignee: MOCK_USERS[0],
    creatorId: 'u1', creator: MOCK_USERS[0],
    createdAt: new Date('2026-03-16'), updatedAt: new Date('2026-03-19'),
    dueDate: new Date('2026-03-25'),
    subtasks: [
      { id: 'st6', title: 'Собрать требования', completed: true, order: 0, taskId: 't6' },
      { id: 'st7', title: 'Написать черновик', completed: false, order: 1, taskId: 't6' },
    ],
  },
  {
    id: 't7', title: 'Обновить базу данных оборудования',
    status: 'TODO', priority: 'LOW', order: 1,
    assigneeId: 'u6', assignee: MOCK_USERS[5],
    creatorId: 'u1', creator: MOCK_USERS[0],
    createdAt: new Date('2026-03-19'), updatedAt: new Date('2026-03-19'),
    dueDate: new Date('2026-04-05'),
  },
  {
    id: 't8', title: 'Верификация акта ГТО-011',
    status: 'DONE', priority: 'MEDIUM', order: 1,
    assigneeId: 'u3', assignee: MOCK_USERS[2],
    creatorId: 'u2', creator: MOCK_USERS[1],
    createdAt: new Date('2026-03-11'), updatedAt: new Date('2026-03-13'),
    completedAt: new Date('2026-03-13'),
  },
  {
    id: 't9', title: 'Организовать совещание по оптимизации маршрутов ТО',
    status: 'REVIEW', priority: 'MEDIUM', order: 1,
    assigneeId: 'u2', assignee: MOCK_USERS[1],
    creatorId: 'u1', creator: MOCK_USERS[0],
    createdAt: new Date('2026-03-17'), updatedAt: new Date('2026-03-19'),
    dueDate: new Date('2026-03-24'),
  },
  {
    id: 't10', title: 'Составить табель учёта рабочего времени',
    status: 'PENDING', priority: 'URGENT', order: 1,
    assigneeId: 'u4', assignee: MOCK_USERS[3],
    creatorId: 'u1', creator: MOCK_USERS[0],
    createdAt: new Date('2026-03-18'), updatedAt: new Date('2026-03-18'),
    dueDate: new Date('2026-03-19'),
  },
]

export const MOCK_ACTIVITY: ActivityLog[] = [
  {
    id: 'a1', action: 'uploaded', details: JSON.stringify({ version: 3, docNumber: 'ДИ-047' }),
    createdAt: new Date(Date.now() - 12 * 60 * 1000),
    userId: 'u2', user: MOCK_USERS[1],
    documentId: 'd1', document: MOCK_DOCUMENTS[0],
  },
  {
    id: 'a2', action: 'approved', details: JSON.stringify({ docNumber: 'АП-031' }),
    createdAt: new Date(Date.now() - 45 * 60 * 1000),
    userId: 'u1', user: MOCK_USERS[0],
    documentId: 'd2', document: MOCK_DOCUMENTS[1],
  },
  {
    id: 'a3', action: 'status_changed', details: JSON.stringify({ from: 'TODO', to: 'ACTIVE', taskTitle: 'Провести плановое ТО' }),
    createdAt: new Date(Date.now() - 90 * 60 * 1000),
    userId: 'u3', user: MOCK_USERS[2],
    taskId: 't2',
  },
  {
    id: 'a4', action: 'commented', details: JSON.stringify({ docNumber: 'СП-022', text: 'Добавлены данные по Q1' }),
    createdAt: new Date(Date.now() - 2.5 * 60 * 60 * 1000),
    userId: 'u4', user: MOCK_USERS[3],
    documentId: 'd5', document: MOCK_DOCUMENTS[4],
  },
  {
    id: 'a5', action: 'completed', details: JSON.stringify({ taskTitle: 'Инструктаж по ТБ' }),
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    userId: 'u2', user: MOCK_USERS[1],
    taskId: 't5',
  },
  {
    id: 'a6', action: 'created', details: JSON.stringify({ docNumber: 'ПР-008' }),
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
    userId: 'u1', user: MOCK_USERS[0],
    documentId: 'd4', document: MOCK_DOCUMENTS[3],
  },
  {
    id: 'a7', action: 'rejected', details: JSON.stringify({ docNumber: 'АП-030', reason: 'Требуются дополнительные данные' }),
    createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
    userId: 'u1', user: MOCK_USERS[0],
    documentId: 'd7', document: MOCK_DOCUMENTS[6],
  },
  {
    id: 'a8', action: 'uploaded', details: JSON.stringify({ version: 2, docNumber: 'ГТО-012' }),
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    userId: 'u5', user: MOCK_USERS[4],
    documentId: 'd3', document: MOCK_DOCUMENTS[2],
  },
]

export const MOCK_DAILY_METRICS: DailyMetric[] = Array.from({ length: 14 }, (_, i) => {
  const date = new Date()
  date.setDate(date.getDate() - (13 - i))
  return {
    id: `m${i}`,
    date,
    documentsCreated: Math.floor(Math.random() * 4) + 1,
    documentsCompleted: Math.floor(Math.random() * 3),
    tasksCreated: Math.floor(Math.random() * 6) + 2,
    tasksCompleted: Math.floor(Math.random() * 5) + 1,
    avgProcessingHours: 18 + Math.random() * 12,
    activeUsers: Math.floor(Math.random() * 3) + 3,
  }
})

// Weekly activity data (7 days)
export const WEEKLY_ACTIVITY = [12, 8, 15, 11, 18, 7, 10]

export const MOCK_METRICS = {
  documentsInProgress: 4,
  documentsTotal: 10,
  tasksCompletedThisWeek: 47,
  totalTasksThisWeek: 64,
  teamOnline: 4,
  teamTotal: 6,
  avgKpi: 87,
  deltas: {
    documents: 12,
    tasks: 8,
    team: 0,
    kpi: -3,
  },
  sparklines: {
    documents: [2, 4, 3, 5, 4, 6, 4],
    tasks: [8, 5, 9, 7, 11, 8, 6],
    team: [3, 4, 4, 3, 5, 4, 4],
    kpi: [89, 85, 88, 84, 87, 89, 87],
  },
}
