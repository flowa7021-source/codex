import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Categories
  const categories = await Promise.all([
    prisma.documentCategory.upsert({
      where: { code: 'ДИ' },
      update: {},
      create: { name: 'Должностные инструкции', code: 'ДИ', color: '#60A5FA' },
    }),
    prisma.documentCategory.upsert({
      where: { code: 'АП' },
      update: {},
      create: { name: 'Акты проверок', code: 'АП', color: '#4ADE80' },
    }),
    prisma.documentCategory.upsert({
      where: { code: 'ГТО' },
      update: {},
      create: { name: 'Графики ТО', code: 'ГТО', color: '#FBBF24' },
    }),
    prisma.documentCategory.upsert({
      where: { code: 'ПР' },
      update: {},
      create: { name: 'Приказы', code: 'ПР', color: '#F87171' },
    }),
    prisma.documentCategory.upsert({
      where: { code: 'СП' },
      update: {},
      create: { name: 'Справки', code: 'СП', color: '#D4A054' },
    }),
  ])

  // Users
  const passwordHash = await hash('nexus2026', 12)

  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: 'salakhutdinov@umit.ru' },
      update: {},
      create: {
        email: 'salakhutdinov@umit.ru',
        passwordHash,
        name: 'Салахутдинов М.М.',
        role: 'MANAGER',
        position: 'Начальник УМиТ',
        status: 'ONLINE',
      },
    }),
    prisma.user.upsert({
      where: { email: 'kozlova@umit.ru' },
      update: {},
      create: {
        email: 'kozlova@umit.ru',
        passwordHash,
        name: 'Козлова Е.Н.',
        role: 'LEAD',
        position: 'Ведущий инженер',
        status: 'ONLINE',
      },
    }),
    prisma.user.upsert({
      where: { email: 'petrov@umit.ru' },
      update: {},
      create: {
        email: 'petrov@umit.ru',
        passwordHash,
        name: 'Петров А.С.',
        role: 'SPECIALIST',
        position: 'Инженер по ТО',
        status: 'AWAY',
      },
    }),
    prisma.user.upsert({
      where: { email: 'ivanova@umit.ru' },
      update: {},
      create: {
        email: 'ivanova@umit.ru',
        passwordHash,
        name: 'Иванова О.В.',
        role: 'SPECIALIST',
        position: 'Специалист по документообороту',
        status: 'ONLINE',
      },
    }),
    prisma.user.upsert({
      where: { email: 'morozov@umit.ru' },
      update: {},
      create: {
        email: 'morozov@umit.ru',
        passwordHash,
        name: 'Морозов Д.И.',
        role: 'LEAD',
        position: 'Ведущий слесарь-ремонтник',
        status: 'OFFLINE',
      },
    }),
    prisma.user.upsert({
      where: { email: 'smirnova@umit.ru' },
      update: {},
      create: {
        email: 'smirnova@umit.ru',
        passwordHash,
        name: 'Смирнова Т.А.',
        role: 'SPECIALIST',
        position: 'Техник по обслуживанию',
        status: 'ONLINE',
      },
    }),
  ])

  const [salakhutdinov, kozlova, petrov, ivanova, morozov, smirnova] = users
  const [diCat, apCat, gtoCat, prCat, spCat] = categories

  // Documents
  const documents = await Promise.all([
    prisma.document.upsert({
      where: { number: 'ДИ-047' },
      update: {},
      create: {
        number: 'ДИ-047',
        title: 'Должностная инструкция слесаря-ремонтника (консолидация)',
        description: 'Консолидированная должностная инструкция для слесарей-ремонтников 3-5 разрядов',
        status: 'REVIEW',
        priority: 'HIGH',
        version: 3,
        authorId: kozlova.id,
        categoryId: diCat.id,
        dueDate: new Date('2026-03-22'),
      },
    }),
    prisma.document.upsert({
      where: { number: 'АП-031' },
      update: {},
      create: {
        number: 'АП-031',
        title: 'Акт проверки технического состояния оборудования цех №3',
        status: 'APPROVED',
        priority: 'MEDIUM',
        version: 1,
        authorId: petrov.id,
        categoryId: apCat.id,
        dueDate: new Date('2026-03-15'),
      },
    }),
    prisma.document.upsert({
      where: { number: 'ГТО-012' },
      update: {},
      create: {
        number: 'ГТО-012',
        title: 'График планово-предупредительного технического обслуживания',
        description: 'Годовой график ТО на 2026 год',
        status: 'ACTIVE',
        priority: 'URGENT',
        version: 2,
        authorId: salakhutdinov.id,
        categoryId: gtoCat.id,
        dueDate: new Date('2026-04-01'),
      },
    }),
    prisma.document.upsert({
      where: { number: 'ПР-008' },
      update: {},
      create: {
        number: 'ПР-008',
        title: 'Приказ об организации дежурства в праздничные дни',
        status: 'DRAFT',
        priority: 'LOW',
        version: 1,
        authorId: salakhutdinov.id,
        categoryId: prCat.id,
      },
    }),
    prisma.document.upsert({
      where: { number: 'СП-022' },
      update: {},
      create: {
        number: 'СП-022',
        title: 'Справка о состоянии технических ресурсов подразделения',
        status: 'REVIEW',
        priority: 'MEDIUM',
        version: 1,
        authorId: ivanova.id,
        categoryId: spCat.id,
        dueDate: new Date('2026-03-21'),
      },
    }),
  ])

  // Tasks
  await Promise.all([
    prisma.task.create({
      data: {
        title: 'Согласовать ДИ-047 с отделом кадров',
        status: 'REVIEW',
        priority: 'HIGH',
        order: 0,
        assigneeId: kozlova.id,
        creatorId: salakhutdinov.id,
        dueDate: new Date('2026-03-22'),
        subtasks: {
          create: [
            { title: 'Отправить на проверку', completed: true, order: 0 },
            { title: 'Получить ответ от ОК', completed: false, order: 1 },
          ],
        },
      },
    }),
    prisma.task.create({
      data: {
        title: 'Провести плановое ТО насосного агрегата №4',
        status: 'ACTIVE',
        priority: 'URGENT',
        order: 0,
        assigneeId: petrov.id,
        creatorId: salakhutdinov.id,
        dueDate: new Date('2026-03-21'),
      },
    }),
    prisma.task.create({
      data: {
        title: 'Подготовить отчёт по итогам Q1',
        status: 'TODO',
        priority: 'MEDIUM',
        order: 0,
        assigneeId: ivanova.id,
        creatorId: salakhutdinov.id,
        dueDate: new Date('2026-03-31'),
      },
    }),
    prisma.task.create({
      data: {
        title: 'Обновить план закупок запчастей',
        status: 'PENDING',
        priority: 'HIGH',
        order: 0,
        assigneeId: morozov.id,
        creatorId: salakhutdinov.id,
        dueDate: new Date('2026-03-18'),
      },
    }),
    prisma.task.create({
      data: {
        title: 'Провести инструктаж по ТБ новых сотрудников',
        status: 'DONE',
        priority: 'MEDIUM',
        order: 0,
        assigneeId: kozlova.id,
        creatorId: salakhutdinov.id,
        completedAt: new Date('2026-03-14'),
      },
    }),
  ])

  // Daily metrics
  for (let i = 0; i < 14; i++) {
    const date = new Date()
    date.setDate(date.getDate() - (13 - i))
    date.setHours(0, 0, 0, 0)

    await prisma.dailyMetric.upsert({
      where: { date },
      update: {},
      create: {
        date,
        documentsCreated: Math.floor(Math.random() * 4) + 1,
        documentsCompleted: Math.floor(Math.random() * 3),
        tasksCreated: Math.floor(Math.random() * 6) + 2,
        tasksCompleted: Math.floor(Math.random() * 5) + 1,
        avgProcessingHours: 18 + Math.random() * 12,
        activeUsers: Math.floor(Math.random() * 3) + 3,
      },
    })
  }

  // Activity log
  const [doc1] = documents
  await prisma.activityLog.createMany({
    data: [
      {
        action: 'uploaded',
        details: JSON.stringify({ version: 3, docNumber: 'ДИ-047' }),
        userId: kozlova.id,
        documentId: doc1.id,
        createdAt: new Date(Date.now() - 12 * 60 * 1000),
      },
      {
        action: 'approved',
        details: JSON.stringify({ docNumber: 'АП-031' }),
        userId: salakhutdinov.id,
        documentId: documents[1].id,
        createdAt: new Date(Date.now() - 45 * 60 * 1000),
      },
      {
        action: 'commented',
        details: JSON.stringify({ docNumber: 'СП-022' }),
        userId: ivanova.id,
        documentId: documents[4].id,
        createdAt: new Date(Date.now() - 150 * 60 * 1000),
      },
    ],
  })

  console.log('✅ Seed complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
