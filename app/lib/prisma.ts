import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

function createPrismaClient() {
  const dbPath = process.env.DATABASE_PATH ?? ':memory:'
  const adapter = new PrismaBetterSqlite3({ url: dbPath })
  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
