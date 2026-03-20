import { NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      include: {
        assignedTasks: {
          where: { status: { not: 'CANCELLED' } },
        },
        _count: {
          select: { assignedTasks: true, documents: true },
        },
      },
      orderBy: { role: 'asc' },
    })

    return NextResponse.json({ data: users })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
