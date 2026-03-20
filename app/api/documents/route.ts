import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const status = searchParams.get('status') || undefined
    const priority = searchParams.get('priority') || undefined
    const authorId = searchParams.get('authorId') || undefined
    const search = searchParams.get('search') || undefined

    const where: any = {}
    if (status) where.status = status
    if (priority) where.priority = priority
    if (authorId) where.authorId = authorId
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { number: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [total, data] = await Promise.all([
      prisma.document.count({ where }),
      prisma.document.findMany({
        where,
        include: {
          author: true,
          category: true,
          tags: { include: { tag: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return NextResponse.json({
      data,
      meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, description, priority, categoryId, authorId, dueDate } = body

    // Generate document number
    const count = await prisma.document.count()
    const category = categoryId
      ? await prisma.documentCategory.findUnique({ where: { id: categoryId } })
      : null
    const prefix = category?.code || 'ДОК'
    const number = `${prefix}-${String(count + 1).padStart(3, '0')}`

    const document = await prisma.document.create({
      data: {
        number,
        title,
        description,
        priority: priority || 'MEDIUM',
        categoryId,
        authorId,
        dueDate: dueDate ? new Date(dueDate) : undefined,
      },
      include: { author: true, category: true },
    })

    return NextResponse.json({ data: document }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
