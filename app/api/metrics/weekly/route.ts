import { NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

export async function GET() {
  try {
    // Fetch daily_metrics for the last 7 days, ordered by date
    const metrics = await prisma.dailyMetric.findMany({
      orderBy: { date: 'asc' },
      take: 7,
    })

    // Return sum of tasks + documents completed per day as activity count
    const data = metrics.map(m => m.tasksCompleted + m.documentsCompleted)

    return NextResponse.json({ data })
  } catch {
    // Fallback to empty on error (dashboard shows static sparkline)
    return NextResponse.json({ data: [] })
  }
}
