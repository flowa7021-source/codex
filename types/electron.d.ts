// Global type for the Electron IPC bridge exposed via contextBridge in preload.ts

interface Window {
  electronAPI: {
    // Window controls
    minimize: () => void
    maximize: () => void
    close: () => void
    // Database queries (IPC invoke → main process → SQLite)
    getMetricsOverview: () => Promise<{
      documentsInProgress: number
      documentsTotal: number
      tasksCompletedThisWeek: number
      totalTasksThisWeek: number
      teamOnline: number
      teamTotal: number
      avgKpi: number
      deltas: { documents: number; tasks: number; team: number; kpi: number }
    }>
    getMetricsWeekly: () => Promise<number[]>
    getDocuments: (params?: {
      page?: number
      pageSize?: number
      status?: string
      priority?: string
      authorId?: string
      search?: string
    }) => Promise<{ data: any[]; meta: { total: number; page: number; pageSize: number; totalPages: number } }>
    getTasks: (params?: { status?: string; assigneeId?: string }) => Promise<any[]>
    getActivity: (params?: { limit?: number; offset?: number }) => Promise<any[]>
    getTeam: () => Promise<any[]>
    getTeamMember: (id: string) => Promise<any | null>
  }
}
