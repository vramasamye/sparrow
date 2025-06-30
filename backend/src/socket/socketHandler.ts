import { Server, Socket } from 'socket.io'
import { verifyToken } from '../utils/jwt'
import { logger } from '../utils/logger'
import { db } from '../services/database'
import { SocketUser, TypingData, MessageData } from '../types'

// Store connected users
const connectedUsers = new Map<string, SocketUser>()
import { Express } from 'express'; // Import Express type

    // const userSockets = new Map<string, string>() // userId -> socketId - This will be managed on app instance


// Helper function to parse mentions and create/emit notifications for socket context
async function handleMentionsAndNotificationsSocket(
  io: Server,
  app: Express, // Add app parameter
  message: any, // Should be a Prisma.MessageGetPayload_decorated type after creation
  senderId: string,
  workspaceId?: string,
  channelId?: string
) {
  const content = message.content as string
  const mentionRegex = /@([\w.-]+)/g
  let match
  const mentionedUsernames: string[] = []
  while ((match = mentionRegex.exec(content)) !== null) {
    mentionedUsernames.push(match[1])
  }

  if (mentionedUsernames.length === 0) {
    return { mentionedUserIds: [] }
  }

  const users = await db.user.findMany({
    where: {
      username: { in: mentionedUsernames },
      ...(workspaceId && { members: { some: { workspaceId } } }),
    },
    select: { id: true, username: true },
  })

  const mentionedUserIds = users.map(u => u.id)
  const userSocketsMap = app.get('userSockets') as Map<string, string> | undefined;


  if (mentionedUserIds.length > 0) {
    const notificationCreateData = mentionedUserIds
      .filter(id => id !== senderId)
      .map(userId => ({
        userId,
        type: 'mention' as const,
        messageId: message.id,
        channelId: channelId,
        senderId,
      }))

    if (notificationCreateData.length > 0) {
      await db.notification.createMany({
        data: notificationCreateData,
      })

      // Emit 'new_notification' to each mentioned user if they are online
      for (const notification of notificationCreateData) {
        const recipientSocketId = userSocketsMap?.get(notification.userId)
        if (recipientSocketId) {
          // Fetch the full notification object to send to the client
          const fullNotification = await db.notification.findFirst({
            where: {
                messageId: notification.messageId,
                userId: notification.userId,
                type: 'mention'
            },
            orderBy: { createdAt: 'desc'}, // In case of duplicate for some reason
            include: {
                sender: { select: { id: true, username: true, name: true }},
                message: { select: { id: true, content: true, channelId: true }},
                channel: { select: { id: true, name: true }}
            }
          })
          if (fullNotification) {
            io.to(recipientSocketId).emit('new_notification', fullNotification)
          }
        }
      }
    }
  }
  return { mentionedUserIds }
}


export const socketHandler = (io: Server, app: Express) => { // Add app parameter
  const userSocketsMap = app.get('userSockets') as Map<string, string>;

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
    if (userSocketsMap) {
        userSocketsMap.set(socket.data.user.id, socket.id);
    }

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

        // Emit event to workspace
        const user = socket.data.user
        const channel = await db.channel.findUnique({ where: { id: channelId }, select: { name: true, workspaceId: true, isPrivate: true }})
        if (channel && channel.workspaceId) {
            io.to(`workspace:${channel.workspaceId}`).emit('user_joined_channel', {
                userId: user.id,
                username: user.username,
                name: user.name,
                channelId: channelId,
                channelName: channel.name,
                isPrivate: channel.isPrivate,
                workspaceId: channel.workspaceId
            })
        }

      } catch (error) {
        logger.error('Join channel error:', error)
        socket.emit('error', { message: 'Failed to join channel' })
      }
    })

    // Leave channel room
    socket.on('leave_channel', async (data: { channelId: string, workspaceId: string }) => {
      const { channelId, workspaceId } = data; // Client should send workspaceId for broadcast
      socket.leave(`channel:${channelId}`)
      logger.info(`User ${socket.data.user.username} left channel ${channelId}`)

      // Emit event to workspace
      if (workspaceId) {
        io.to(`workspace:${workspaceId}`).emit('user_left_channel', {
            userId: socket.data.user.id,
            username: socket.data.user.username,
            channelId: channelId,
            workspaceId: workspaceId
        })
      } else {
        // Fallback: try to get workspaceId from connectedUsers map if client doesn't send it
        // This is less reliable as user might not be in connectedUsers' workspace context correctly
        const user = connectedUsers.get(socket.id);
        if (user && user.workspaceId) {
             io.to(`workspace:${user.workspaceId}`).emit('user_left_channel', {
                userId: socket.data.user.id,
                username: socket.data.user.username,
                channelId: channelId,
                workspaceId: user.workspaceId
            })
        } else {
            logger.warn(`Could not determine workspaceId for user ${socket.data.user.username} leaving channel ${channelId} to broadcast user_left_channel.`);
        }
      }
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
        const senderUser = socket.data.user

        if (channelId) {
          // Channel message
          const membership = await db.channelMember.findFirst({
            where: { channelId, userId },
          })
          if (!membership) {
            socket.emit('error', { message: 'Not authorized to send message to this channel' })
            return
          }

          const channel = await db.channel.findUnique({ where: { id: channelId } })
          if (!channel) {
            socket.emit('error', { message: 'Channel not found' })
            return
          }

          // 1. Create message
          let createdMessage = await db.message.create({
            data: {
              content,
              userId,
              channelId,
              workspaceId: channel.workspaceId,
            },
            include: { user: { select: { id: true, username: true, name: true } } },
          })

          // 2. Handle mentions and notifications
          const { mentionedUserIds } = await handleMentionsAndNotificationsSocket(
            io,
            app, // Pass app
            createdMessage,
            userId,
            channel.workspaceId,
            channelId
          )

          // 3. Update message with mentionedUserIds if any
          if (mentionedUserIds.length > 0) {
            createdMessage = await db.message.update({
              where: { id: createdMessage.id },
              data: { mentionedUserIds: mentionedUserIds.join(',') },
              include: { user: { select: { id: true, username: true, name: true } } },
            })
          }

          message = createdMessage // Use the potentially updated message

          // Broadcast to channel members
          io.to(`channel:${channelId}`).emit('new_message', {
            id: message.id,
            content: message.content,
            userId: message.userId,
            channelId: message.channelId,
            workspaceId: message.workspaceId,
            mentionedUserIds: message.mentionedUserIds,
            createdAt: message.createdAt.toISOString(),
            user: message.user,
          })

        } else if (recipientId) {
          // Direct message
          message = await db.message.create({
            data: { content, userId, recipientId },
            include: { user: { select: { id: true, username: true, name: true } } },
          })

          const messageData: MessageData = {
            id: message.id,
            content: message.content,
            userId: message.userId,
            recipientId: message.recipientId,
            createdAt: message.createdAt.toISOString(),
            user: message.user,
          }

          // Send to sender
          socket.emit('new_direct_message', messageData)

          // Send to recipient if online
          const recipientSocketId = userSocketsMap?.get(recipientId)
          if (recipientSocketId) {
            io.to(recipientSocketId).emit('new_direct_message', messageData)

            // Create and emit notification for DM
            if (userId !== recipientId) {
              const notification = await db.notification.create({
                data: {
                  userId: recipientId,
                  type: 'new_dm',
                  messageId: message.id,
                  senderId: userId,
                },
                include: {
                    sender: { select: { id: true, username: true, name: true }},
                    message: { select: { id: true, content: true, channelId: true, recipientId: true }},
                }
              })
              io.to(recipientSocketId).emit('new_notification', notification)
            }
          }
        } else {
            socket.emit('error', { message: 'Message target (channelId or recipientId) is required.'})
            return
        }

        logger.info(`Message sent by ${senderUser.username} to ${channelId ? `channel ${channelId}` : `user ${recipientId}`}`)
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
      if (userSocketsMap) {
        userSocketsMap.delete(socket.data.user.id);
      }
    })

    // Handle errors
    socket.on('error', (error) => {
      logger.error('Socket error:', error)
    })
  })

  // Utility functions for external use
  // These may need `app` if they are to be called from outside, or be refactored
  // For now, assuming they are called from contexts where `app` or `userSocketsMap` is available
  // Or, they are fine if `userSocketsMap` is kept up-to-date by the main handler instance.
  return {
    getConnectedUsers: () => Array.from(connectedUsers.values()),
    // getUserSocket: (userId: string) => userSocketsMap?.get(userId), // This would need app if called externally
    // emitToUser: (userId: string, event: string, data: any) => { // This would need app
    //   const socketId = userSocketsMap?.get(userId)
    //   if (socketId) {
    //     io.to(socketId).emit(event, data)
    //   }
    // },
    // The following are fine as they use io directly for room emissions
    emitToWorkspace: (workspaceId: string, event: string, data: any) => {
      io.to(`workspace:${workspaceId}`).emit(event, data)
    },
    emitToChannel: (channelId: string, event: string, data: any) => {
      io.to(`channel:${channelId}`).emit(event, data)
    }
  }
}