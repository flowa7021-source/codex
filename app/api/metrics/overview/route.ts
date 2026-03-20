import { NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

export async function GET() {
  try {
    const now = new Date()
    const weekAgo = new Date(now)
    weekAgo.setDate(weekAgo.getDate() - 7)

    const [
      documentsInProgress,
      documentsTotal,
      tasksCompletedThisWeek,
      totalTasksThisWeek,
      teamOnline,
      teamTotal,
    ] = await Promise.all([
      prisma.document.count({ where: { status: { in: ['ACTIVE', 'REVIEW'] } } }),
      prisma.document.count(),
      prisma.task.count({ where: { status: 'DONE', completedAt: { gte: weekAgo } } }),
      prisma.task.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.user.count({ where: { status: 'ONLINE' } }),
      prisma.user.count(),
    ])

    return NextResponse.json({
      data: {
        documentsInProgress,
        documentsTotal,
        tasksCompletedThisWeek,
        totalTasksThisWeek,
        teamOnline,
        teamTotal,
        avgKpi: 87,
        deltas: { documents: 12, tasks: 8, team: 0, kpi: -3 },
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
