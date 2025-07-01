import { Router } from 'express'
import { db } from '../services/database'
import { AuthenticatedRequest } from '../types'
import { logger } from '../utils/logger'

const router = Router()

// Helper function to parse mentions and create notifications
async function handleMentionsAndNotifications(message: any, senderId: string, workspaceId?: string, channelId?: string) {
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
      // Optionally, filter by workspace members if workspaceId is available
      ...(workspaceId && { members: { some: { workspaceId } } }),
    },
    select: { id: true, username: true },
  })

  const mentionedUserIds = users.map(u => u.id)

  // Create notifications for mentioned users
  if (mentionedUserIds.length > 0) {
    const notifications = mentionedUserIds
      .filter(id => id !== senderId) // Don't notify self
      .map(userId => ({
        userId,
        type: 'mention',
        messageId: message.id,
        channelId: channelId,
        senderId,
      }))

    if (notifications.length > 0) {
      await db.notification.createMany({
        data: notifications,
      })
      // TODO: Emit socket event for new notifications to these users
    }
  }
  return { mentionedUserIds }
}


// Send message to channel
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { content, channelId, recipientId } = req.body
    const userId = req.user!.id

    if (!content) {
      return res.status(400).json({ error: 'Message content is required' })
    }

    if (!channelId && !recipientId) {
      return res.status(400).json({ error: 'Either channelId or recipientId is required' })
    }

    let message

    if (channelId) {
      // Channel message
      const membership = await db.channelMember.findFirst({
        where: { channelId, userId },
      })
      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this channel' })
      }

      const channel = await db.channel.findUnique({ where: { id: channelId } })
      if (!channel) {
        return res.status(404).json({ error: 'Channel not found' })
      }

      // 1. Create the message first (without mentionedUserIds initially)
      message = await db.message.create({
        data: {
          content,
          userId,
          channelId,
          workspaceId: channel.workspaceId,
          // mentionedUserIds will be updated after parsing
        },
        include: { user: { select: { id: true, username: true, name: true } } },
      })

      // 2. Handle mentions and create notifications using the created message
      const { mentionedUserIds } = await handleMentionsAndNotifications(
        message, // Pass the full message object
        userId,
        channel.workspaceId,
        channelId
      )

      // 3. Update the message with mentionedUserIds
      if (mentionedUserIds.length > 0) {
        message = await db.message.update({
          where: { id: message.id },
          data: { mentionedUserIds: mentionedUserIds.join(',') },
          include: { user: { select: { id: true, username: true, name: true } } },
        })
      }

    } else if (recipientId) {
      // Direct message
      message = await db.message.create({
        data: { content, userId, recipientId },
        include: { user: { select: { id: true, username: true, name: true } } },
      })

      // Create notification for direct message
      if (userId !== recipientId) { // Don't notify self
        await db.notification.create({
          data: {
            userId: recipientId,
            type: 'new_dm',
            messageId: message.id,
            senderId: userId,
          },
        })
        // TODO: Emit socket event for new_dm notification to recipient in socketHandler
      }
    } else {
      // This case should already be caught by the initial check
      return res.status(400).json({ error: 'Message target (channelId or recipientId) not specified.' })
    }

    logger.info(`Message sent by ${req.user!.username} to ${channelId ? 'channel ' + channelId : 'user ' + recipientId}`)

    res.status(201).json({ message })
  } catch (error) {
    logger.error('Send message error:', error)
    res.status(500).json({ error: 'Failed to send message' })
  }
})

// Get messages (channel or direct messages)
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { channelId, recipientId } = req.query
    const userId = req.user!.id
    const limit = parseInt(req.query.limit as string) || 50
    const offset = parseInt(req.query.offset as string) || 0

    let messages

    if (channelId) {
      // Channel messages
      // Check if user is member of channel
      const membership = await db.channelMember.findFirst({
        where: {
          channelId: channelId as string,
          userId
        }
      })

      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this channel' })
      }

      messages = await db.message.findMany({
        where: {
          channelId: channelId as string
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              name: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit,
        skip: offset
      })
    } else if (recipientId) {
      // Direct messages
      messages = await db.message.findMany({
        where: {
          OR: [
            {
              userId,
              recipientId: recipientId as string
            },
            {
              userId: recipientId as string,
              recipientId: userId
            }
          ]
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              name: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit,
        skip: offset
      })
    } else {
      return res.status(400).json({ error: 'Either channelId or recipientId is required' })
    }

    res.json({ messages: messages.reverse() })
  } catch (error) {
    logger.error('Get messages error:', error)
    res.status(500).json({ error: 'Failed to fetch messages' })
  }
})

// Delete message
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params
    const userId = req.user!.id

    const message = await db.message.findUnique({
      where: { id }
    })

    if (!message) {
      return res.status(404).json({ error: 'Message not found' })
    }

    // Check if user owns the message
    if (message.userId !== userId) {
      return res.status(403).json({ error: 'You can only delete your own messages' })
    }

    const originalMessageData = {
      id: message.id,
      channelId: message.channelId,
      recipientId: message.recipientId,
      userId: message.userId
    }

    await db.message.delete({
      where: { id }
    })

    // Emit socket event for message deletion
    const io = req.app.get('io')
    if (io) {
      if (originalMessageData.channelId) {
        io.to(`channel:${originalMessageData.channelId}`).emit('message_deleted', { id: originalMessageData.id, channelId: originalMessageData.channelId })
      } else if (originalMessageData.recipientId) {
        const userSocketsMap = req.app.get('userSockets') as Map<string, string> | undefined;
        const senderSocketId = userSocketsMap?.get(originalMessageData.userId)
        // Ensure recipientId is not null before trying to get its socket
        const recipientSocketId = originalMessageData.recipientId ? userSocketsMap?.get(originalMessageData.recipientId) : undefined

        const payload = {
            id: originalMessageData.id,
            recipientId: originalMessageData.recipientId,
            userId: originalMessageData.userId
        }
        if (senderSocketId) io.to(senderSocketId).emit('message_deleted', payload)
        if (recipientSocketId && recipientSocketId !== senderSocketId) {
            io.to(recipientSocketId).emit('message_deleted', payload)
        }
      }
    }

    logger.info(`Message ${id} deleted by ${req.user!.username}`)

    res.json({ success: true, message: 'Message deleted successfully' })
  } catch (error) {
    logger.error('Delete message error:', error)
    res.status(500).json({ error: 'Failed to delete message' })
  }
})

// Update message
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params
    const { content } = req.body
    const userId = req.user!.id

    if (!content) {
      return res.status(400).json({ error: 'Message content is required' })
    }

    const message = await db.message.findUnique({
      where: { id }
    })

    if (!message) {
      return res.status(404).json({ error: 'Message not found' })
    }

    // Check if user owns the message
    if (message.userId !== userId) {
      return res.status(403).json({ error: 'You can only edit your own messages' })
    }

    const updatedMessage = await db.message.update({
      where: { id },
      data: { content },
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

    // Emit socket event for message update
    const io = req.app.get('io')
    if (io) {
      if (updatedMessage.channelId) {
        io.to(`channel:${updatedMessage.channelId}`).emit('message_updated', updatedMessage)
      } else if (updatedMessage.recipientId) {
        // For DMs, send to both sender and recipient if they are online
        const senderSocketId = req.app.get('userSockets')?.get(updatedMessage.userId) // userSockets should be on app
        const recipientSocketId = req.app.get('userSockets')?.get(updatedMessage.recipientId)
        if (senderSocketId) io.to(senderSocketId).emit('message_updated', updatedMessage)
        if (recipientSocketId && recipientSocketId !== senderSocketId) io.to(recipientSocketId).emit('message_updated', updatedMessage)
      }
    }

    logger.info(`Message ${id} updated by ${req.user!.username}`)

    res.json({ message: updatedMessage })
  } catch (error) {
    logger.error('Update message error:', error)
    res.status(500).json({ error: 'Failed to update message' })
  }
})

export default router