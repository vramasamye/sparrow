import { Router } from 'express'
import { db } from '../services/database'
import { AuthenticatedRequest } from '../types'
import { logger } from '../utils/logger'

const router = Router()

// Get notifications for the current user
// Initially, let's fetch unread notifications, ordered by most recent
// We can add pagination and filtering (e.g., all, unread) later
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id
    const { limit = 20, offset = 0, status = 'unread', type, senderId } = req.query;

    const whereClause: any = {
      userId,
    };

    if (status === 'unread') {
      whereClause.isRead = false;
    } else if (status === 'read') {
      whereClause.isRead = true;
    }
    // If status is 'all' or undefined, no isRead filter is applied.

    if (type) {
      whereClause.type = type as string;
    }
    if (senderId) {
      whereClause.senderId = senderId as string;
    }

    const notifications = await db.notification.findMany({
      where: whereClause,
      include: {
        sender: { select: { id: true, username: true, name: true, avatar: true } },
        message: {
          select: {
            id: true,
            content: true,
            channelId: true,
            recipientId: true, // For DMs
            workspaceId: true,
          }
        },
        channel: { select: { id: true, name: true, workspaceId: true } }, // For channel context in mentions
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: parseInt(limit as string, 10),
      skip: parseInt(offset as string, 10),
    })

    const totalUnread = await db.notification.count({
      where: { userId, isRead: false },
    })

    res.json({ notifications, totalUnread, limit, offset, status })
  } catch (error) {
    logger.error('Get notifications error:', error)
    res.status(500).json({ error: 'Failed to fetch notifications' })
  }
})

// Mark a specific notification as read
router.post('/:id/read', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params
    const userId = req.user!.id

    const notification = await db.notification.findUnique({
      where: { id },
    })

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' })
    }

    if (notification.userId !== userId) {
      return res.status(403).json({ error: 'You can only mark your own notifications as read' })
    }

    const updatedNotification = await db.notification.update({
      where: { id },
      data: { isRead: true },
      include: { // Return the updated notification with details
        sender: { select: { id: true, username: true, name: true, avatar: true } },
        message: { select: { id: true, content: true, channelId: true, recipientId: true, workspaceId: true } },
        channel: { select: { id: true, name: true, workspaceId: true } },
      }
    })

    logger.info(`Notification ${id} marked as read by user ${userId}`)
    res.json({ notification: updatedNotification })
  } catch (error) {
    logger.error('Mark notification read error:', error)
    res.status(500).json({ error: 'Failed to mark notification as read' })
  }
})

// Mark all notifications for a user as read
router.post('/read-all', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id

    await db.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    })

    logger.info(`All unread notifications marked as read for user ${userId}`)
    res.json({ success: true, message: 'All notifications marked as read' })
  } catch (error) {
    logger.error('Mark all notifications read error:', error)
    res.status(500).json({ error: 'Failed to mark all notifications as read' })
  }
})

export default router
