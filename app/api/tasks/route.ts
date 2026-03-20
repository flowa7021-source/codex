import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || undefined
    const assigneeId = searchParams.get('assigneeId') || undefined

    const where: any = {}
    if (status) where.status = status
    if (assigneeId) where.assigneeId = assigneeId

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignee: true,
        creator: true,
        subtasks: { orderBy: { order: 'asc' } },
        tags: { include: { tag: true } },
      },
      orderBy: [{ status: 'asc' }, { order: 'asc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({ data: tasks })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, description, priority, status, assigneeId, creatorId, dueDate, documentId } = body

    const task = await prisma.task.create({
      data: {
        title,
        description,
        priority: priority || 'MEDIUM',
        status: status || 'TODO',
        assigneeId,
        creatorId,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        documentId,
      },
      include: { assignee: true, creator: true },
    })

    return NextResponse.json({ data: task }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
