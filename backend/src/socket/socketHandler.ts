import { Server, Socket } from 'socket.io'
import { verifyToken } from '../utils/jwt'
import { logger } from '../utils/logger'
import { db } from '../services/database'
import { SocketUser, TypingData, MessageData } from '../types'

// Store connected users
const connectedUsers = new Map<string, SocketUser>()
const userSockets = new Map<string, string>() // userId -> socketId

export const socketHandler = (io: Server) => {
  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const { token, user } = socket.handshake.auth
      
      if (!token || !user) {
        logger.warn('Socket auth failed: Missing token or user')
        return next(new Error('Authentication error: No token or user provided'))
      }

      // Handle both JWT tokens and mock tokens for development
      if ((token.startsWith('mock-') || token.length > 50) && user.email) {
        try {
          // Find or create user in database
          let dbUser = await db.user.findUnique({
            where: { email: user.email },
            select: {
              id: true,
              username: true,
              name: true,
              email: true
            }
          })

          if (!dbUser) {
            // Create user if doesn't exist (for development)
            logger.info(`Creating new user: ${user.email}`)
            dbUser = await db.user.create({
              data: {
                email: user.email,
                username: user.username || user.name || user.email.split('@')[0],
                name: user.name || user.username || user.email.split('@')[0],
                password: 'mock-password' // This would be properly hashed in production
              },
              select: {
                id: true,
                username: true,
                name: true,
                email: true
              }
            })
            logger.info(`User created successfully: ${dbUser.username}`)
          }

          socket.data.user = dbUser
          logger.info(`Socket authenticated for user: ${dbUser.username}`)
          next()
        } catch (dbError) {
          logger.error('Database error during socket auth:', dbError)
          return next(new Error('Database connection error'))
        }
      } else {
        logger.warn('Socket auth failed: Invalid token format', { token: token.substring(0, 10) })
        return next(new Error('Authentication error: Invalid token format'))
      }
    } catch (error) {
      logger.error('Socket authentication error:', error)
      next(new Error('Authentication error'))
    }
  })

  io.on('connection', (socket: Socket) => {
    logger.info(`User connected: ${socket.data.user.username} (${socket.id})`)

    // Add user to connected users
    const socketUser: SocketUser = {
      id: socket.data.user.id,
      username: socket.data.user.username,
      name: socket.data.user.name,
      workspaceId: '',
      socketId: socket.id,
      isOnline: true
    }

    connectedUsers.set(socket.id, socketUser)
    userSockets.set(socket.data.user.id, socket.id)

    // Join workspace room
    socket.on('join_workspace', async (workspaceId: string) => {
      try {
        // Verify user is member of workspace
        const membership = await db.member.findFirst({
          where: {
            workspaceId,
            userId: socket.data.user.id
          }
        })

        if (!membership) {
          socket.emit('error', { message: 'Not authorized to join this workspace' })
          return
        }

        socket.join(`workspace:${workspaceId}`)
        
        // Update user's current workspace
        const user = connectedUsers.get(socket.id)
        if (user) {
          user.workspaceId = workspaceId
          connectedUsers.set(socket.id, user)
        }

        // Notify other users in workspace about user coming online
        socket.to(`workspace:${workspaceId}`).emit('user_online', {
          userId: socket.data.user.id,
          username: socket.data.user.username,
          name: socket.data.user.name
        })

        logger.info(`User ${socket.data.user.username} joined workspace ${workspaceId}`)
      } catch (error) {
        logger.error('Join workspace error:', error)
        socket.emit('error', { message: 'Failed to join workspace' })
      }
    })

    // Join channel room
    socket.on('join_channel', async (channelId: string) => {
      try {
        // Verify user is member of channel
        const membership = await db.channelMember.findFirst({
          where: {
            channelId,
            userId: socket.data.user.id
          }
        })

        if (!membership) {
          socket.emit('error', { message: 'Not authorized to join this channel' })
          return
        }

        socket.join(`channel:${channelId}`)
        logger.info(`User ${socket.data.user.username} joined channel ${channelId}`)
      } catch (error) {
        logger.error('Join channel error:', error)
        socket.emit('error', { message: 'Failed to join channel' })
      }
    })

    // Leave channel room
    socket.on('leave_channel', (channelId: string) => {
      socket.leave(`channel:${channelId}`)
      logger.info(`User ${socket.data.user.username} left channel ${channelId}`)
    })

    // Handle new message
    socket.on('send_message', async (data: { channelId?: string; recipientId?: string; content: string }) => {
      try {
        const { channelId, recipientId, content } = data
        const userId = socket.data.user.id

        if (!content) {
          socket.emit('error', { message: 'Message content is required' })
          return
        }

        let message

        if (channelId) {
          // Channel message
          // Verify user is member of channel
          const membership = await db.channelMember.findFirst({
            where: {
              channelId,
              userId
            }
          })

          if (!membership) {
            socket.emit('error', { message: 'Not authorized to send message to this channel' })
            return
          }

          // Get channel to find workspace
          const channel = await db.channel.findUnique({
            where: { id: channelId }
          })

          message = await db.message.create({
            data: {
              content,
              userId,
              channelId,
              workspaceId: channel?.workspaceId
            },
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  name: true
                }
              }
            }
          })

          // Broadcast to channel members
          io.to(`channel:${channelId}`).emit('new_message', {
            id: message.id,
            content: message.content,
            userId: message.userId,
            channelId: message.channelId,
            workspaceId: message.workspaceId,
            createdAt: message.createdAt.toISOString(),
            user: message.user
          })

        } else if (recipientId) {
          // Direct message
          message = await db.message.create({
            data: {
              content,
              userId,
              recipientId
            },
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  name: true
                }
              }
            }
          })

          const messageData: MessageData = {
            id: message.id,
            content: message.content,
            userId: message.userId,
            recipientId: message.recipientId,
            createdAt: message.createdAt.toISOString(),
            user: message.user
          }

          // Send to sender
          socket.emit('new_direct_message', messageData)

          // Send to recipient if online
          const recipientSocketId = userSockets.get(recipientId)
          if (recipientSocketId) {
            io.to(recipientSocketId).emit('new_direct_message', messageData)
          }
        }

        logger.info(`Message sent by ${socket.data.user.username}`)
      } catch (error) {
        logger.error('Send message error:', error)
        socket.emit('error', { message: 'Failed to send message' })
      }
    })

    // Handle typing indicators
    socket.on('start_typing', async (data: { channelId: string }) => {
      try {
        const { channelId } = data
        
        // Verify user is member of channel
        const membership = await db.channelMember.findFirst({
          where: {
            channelId,
            userId: socket.data.user.id
          }
        })

        if (!membership) {
          return
        }

        const typingData: TypingData = {
          userId: socket.data.user.id,
          username: socket.data.user.username,
          channelId
        }

        socket.to(`channel:${channelId}`).emit('user_typing', typingData)
      } catch (error) {
        logger.error('Start typing error:', error)
      }
    })

    socket.on('stop_typing', async (data: { channelId: string }) => {
      try {
        const { channelId } = data
        
        // Verify user is member of channel
        const membership = await db.channelMember.findFirst({
          where: {
            channelId,
            userId: socket.data.user.id
          }
        })

        if (!membership) {
          return
        }

        socket.to(`channel:${channelId}`).emit('user_stop_typing', {
          userId: socket.data.user.id,
          channelId
        })
      } catch (error) {
        logger.error('Stop typing error:', error)
      }
    })

    // Handle disconnect
    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${socket.data.user.username} (${socket.id})`)

      const user = connectedUsers.get(socket.id)
      if (user && user.workspaceId) {
        // Notify other users in workspace about user going offline
        socket.to(`workspace:${user.workspaceId}`).emit('user_offline', {
          userId: user.id,
          username: user.username
        })
      }

      // Remove user from connected users
      connectedUsers.delete(socket.id)
      userSockets.delete(socket.data.user.id)
    })

    // Handle errors
    socket.on('error', (error) => {
      logger.error('Socket error:', error)
    })
  })

  // Utility functions for external use
  return {
    getConnectedUsers: () => Array.from(connectedUsers.values()),
    getUserSocket: (userId: string) => userSockets.get(userId),
    emitToUser: (userId: string, event: string, data: any) => {
      const socketId = userSockets.get(userId)
      if (socketId) {
        io.to(socketId).emit(event, data)
      }
    },
    emitToWorkspace: (workspaceId: string, event: string, data: any) => {
      io.to(`workspace:${workspaceId}`).emit(event, data)
    },
    emitToChannel: (channelId: string, event: string, data: any) => {
      io.to(`channel:${channelId}`).emit(event, data)
    }
  }
}