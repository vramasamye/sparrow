import { PrismaClient } from '@prisma/client'
import { logger } from '../utils/logger'

declare global {
  var __db__: PrismaClient | undefined
}

let db: PrismaClient

if (process.env.NODE_ENV === 'production') {
  db = new PrismaClient({
    log: ['error', 'warn'],
    errorFormat: 'pretty'
  })
} else {
  if (!global.__db__) {
    global.__db__ = new PrismaClient({
      log: ['query', 'error', 'warn'],
      errorFormat: 'pretty'
    })
  }
  db = global.__db__
}

// Connection event handlers
process.on('beforeExit', async () => {
  logger.info('Database connection closing')
  await db.$disconnect()
})

// Test connection
db.$connect()
  .then(() => {
    logger.info('Database connected successfully')
  })
  .catch((error) => {
    logger.error('Database connection failed:', error)
    process.exit(1)
  })

export { db }