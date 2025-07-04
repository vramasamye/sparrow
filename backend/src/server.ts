import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'

import { logger } from './utils/logger'
import { authMiddleware } from './middleware/auth'
import { errorHandler } from './middleware/error'
import { socketHandler } from './socket/socketHandler'

import authRoutes from './routes/auth'
import workspaceRoutes from './routes/workspaces'
import channelRoutes from './routes/channels'
import messageRoutes from './routes/messages'
import userRoutes from './routes/users'
import notificationRoutes from './routes/notifications'
import reactionRoutes from './routes/reactions'
import fileRoutes from './routes/files'
import publicFileRoutes from './routes/publicFiles'
import inviteRoutes from './routes/invites'
import notificationPreferenceRoutes from './routes/notificationPreferences' // Import new routes

dotenv.config()

const app = express()
const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
})

const PORT = process.env.PORT || 8000

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
})
app.use('/api/', limiter)

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3001",
  credentials: true
}))

// Compression
app.use(compression())

// Logging
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }))

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  })
})
app.set('io', io); // Make io instance available to routes
app.set('userSockets', new Map<string, string>()); // Initialize userSockets map

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/invites', inviteRoutes); // Invite routes (GET /:token is unauthenticated, POST /:token/accept needs auth)
app.use('/api/workspaces', authMiddleware, workspaceRoutes) // This handles /api/workspaces and /api/workspaces/:workspaceId
// Mount channelRoutes under /api/workspaces/:workspaceId/channels
// Note: workspaceRoutes already handles /:workspaceId, so this needs to be integrated carefully OR
// channelRoutes is mounted specifically.
// For clarity, let's ensure workspaceRoutes does not also try to handle /:workspaceId/channels if we mount it separately.
app.use('/api/workspaces/:workspaceId/channels', authMiddleware, channelRoutes); // New mount for channel routes
// app.use('/api/channels', authMiddleware, channelRoutes) // Old one, to be removed or ensure it's gone

app.use('/api/messages', authMiddleware, messageRoutes)
app.use('/api/users', authMiddleware, userRoutes)
app.use('/api/notifications', authMiddleware, notificationRoutes)
app.use('/api/workspaces/:workspaceId/files', authMiddleware, fileRoutes)
app.use('/api/public-files', publicFileRoutes)
app.use('/api/notification-preferences', authMiddleware, notificationPreferenceRoutes); // Mount new routes

// Socket.io handling
socketHandler(io, app) // Pass app to socketHandler

// Error handling
app.use(errorHandler)

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`)
  logger.info(`Environment: ${process.env.NODE_ENV}`)
  logger.info(`Frontend URL: ${process.env.FRONTEND_URL}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully')
  server.close(() => {
    logger.info('Process terminated')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully')
  server.close(() => {
    logger.info('Process terminated')
    process.exit(0)
  })
})

export { app, server, io }