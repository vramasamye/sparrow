import { Router } from 'express'
import { db } from '../services/database'
import { AuthenticatedRequest } from '../types'
import { logger } from '../utils/logger'

const router = Router()

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
      // Check if user is member of channel
      const membership = await db.channelMember.findFirst({
        where: {
          channelId,
          userId
        }
      })

      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this channel' })
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
    } else {
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

    await db.message.delete({
      where: { id }
    })

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

    logger.info(`Message ${id} updated by ${req.user!.username}`)

    res.json({ message: updatedMessage })
  } catch (error) {
    logger.error('Update message error:', error)
    res.status(500).json({ error: 'Failed to update message' })
  }
})

export default router