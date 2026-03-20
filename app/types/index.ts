export type UserRole = 'ADMIN' | 'MANAGER' | 'LEAD' | 'SPECIALIST'
export type OnlineStatus = 'ONLINE' | 'AWAY' | 'OFFLINE'
export type DocumentStatus = 'DRAFT' | 'ACTIVE' | 'REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED'
export type TaskStatus = 'TODO' | 'ACTIVE' | 'PENDING' | 'REVIEW' | 'DONE' | 'CANCELLED'
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type ApprovalDecision = 'APPROVED' | 'REJECTED' | 'REQUESTED_CHANGES'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  position: string
  avatar?: string | null
  status: OnlineStatus
  lastSeenAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface Document {
  id: string
  number: string
  title: string
  description?: string | null
  status: DocumentStatus
  priority: Priority
  version: number
  filePath?: string | null
  fileSize?: number | null
  authorId: string
  author: User
  categoryId?: string | null
  category?: DocumentCategory | null
  createdAt: Date
  updatedAt: Date
  dueDate?: Date | null
  tags?: TagOnDocument[]
  approvals?: Approval[]
  comments?: Comment[]
  versions?: DocumentVersion[]
}

export interface DocumentCategory {
  id: string
  name: string
  code: string
  color: string
}

export interface DocumentVersion {
  id: string
  version: number
  filePath: string
  fileSize?: number | null
  changelog?: string | null
  createdAt: Date
  documentId: string
  createdById: string
}

export interface Task {
  id: string
  title: string
  description?: string | null
  status: TaskStatus
  priority: Priority
  order: number
  dueDate?: Date | null
  assigneeId?: string | null
  assignee?: User | null
  creatorId: string
  creator: User
  documentId?: string | null
  createdAt: Date
  updatedAt: Date
  completedAt?: Date | null
  subtasks?: Subtask[]
  tags?: TagOnTask[]
  comments?: Comment[]
}

export interface Subtask {
  id: string
  title: string
  completed: boolean
  order: number
  taskId: string
}

export interface Comment {
  id: string
  text: string
  createdAt: Date
  updatedAt: Date
  authorId: string
  author: User
  documentId?: string | null
  taskId?: string | null
  parentId?: string | null
  replies?: Comment[]
}

export interface Approval {
  id: string
  decision: ApprovalDecision
  comment?: string | null
  createdAt: Date
  userId: string
  user: User
  documentId: string
}

export interface ActivityLog {
  id: string
  action: string
  details?: string | null
  createdAt: Date
  userId: string
  user: User
  documentId?: string | null
  document?: Document | null
  taskId?: string | null
  task?: Task | null
}

export interface Tag {
  id: string
  name: string
  color: string
}

export interface TagOnDocument {
  documentId: string
  tagId: string
  tag: Tag
}

export interface TagOnTask {
  taskId: string
  tagId: string
  tag: Tag
}

export interface DailyMetric {
  id: string
  date: Date
  documentsCreated: number
  documentsCompleted: number
  tasksCreated: number
  tasksCompleted: number
  avgProcessingHours?: number | null
  activeUsers: number
}

export interface MetricsOverview {
  documentsInProgress: number
  documentsTotal: number
  tasksCompletedThisWeek: number
  totalTasksThisWeek: number
  teamOnline: number
  teamTotal: number
  avgKpi: number
  deltas: {
    documents: number
    tasks: number
    team: number
    kpi: number
  }
  sparklines: {
    documents: number[]
    tasks: number[]
    team: number[]
    kpi: number[]
  }
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
}

export interface ApiResponse<T> {
  data: T
  error?: string
}
