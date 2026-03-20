import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        assignedTasks: {
          include: { assignee: true },
          orderBy: { createdAt: 'desc' },
        },
        documents: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ data: user })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
