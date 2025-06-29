import { Router } from 'express'
import { db } from '../services/database'
import { AuthenticatedRequest } from '../types'
import { logger } from '../utils/logger'

const router = Router()

// Create channel
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { name, description, isPrivate, workspaceId } = req.body
    const userId = req.user!.id

    if (!name || !workspaceId) {
      return res.status(400).json({ error: 'Channel name and workspace ID are required' })
    }

    // Check if user is member of workspace
    const membership = await db.member.findFirst({
      where: {
        workspaceId,
        userId
      }
    })

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this workspace' })
    }

    // Check if channel name already exists in workspace
    const existingChannel = await db.channel.findFirst({
      where: {
        workspaceId,
        name: name.toLowerCase()
      }
    })

    if (existingChannel) {
      return res.status(409).json({ error: 'A channel with this name already exists' })
    }

    const channel = await db.channel.create({
      data: {
        name: name.toLowerCase(),
        description,
        isPrivate: isPrivate || false,
        workspaceId,
        createdBy: userId,
        members: {
          create: {
            userId
          }
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true
              }
            }
          }
        }
      }
    })

    logger.info(`Channel created: ${channel.name} in workspace ${workspaceId}`)

    res.status(201).json({ channel })
  } catch (error) {
    logger.error('Create channel error:', error)
    res.status(500).json({ error: 'Failed to create channel' })
  }
})

// Get channel messages
router.get('/:id/messages', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params
    const userId = req.user!.id
    const limit = parseInt(req.query.limit as string) || 50
    const offset = parseInt(req.query.offset as string) || 0

    // Check if user is member of channel
    const membership = await db.channelMember.findFirst({
      where: {
        channelId: id,
        userId
      }
    })

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this channel' })
    }

    const messages = await db.message.findMany({
      where: {
        channelId: id
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

    res.json({ messages: messages.reverse() })
  } catch (error) {
    logger.error('Get channel messages error:', error)
    res.status(500).json({ error: 'Failed to fetch messages' })
  }
})

// Join channel
router.post('/:id/join', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params
    const userId = req.user!.id

    // Check if channel exists and user has access
    const channel = await db.channel.findUnique({
      where: { id },
      include: {
        workspace: {
          include: {
            members: true
          }
        }
      }
    })

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' })
    }

    // Check if user is member of workspace
    const workspaceMembership = channel.workspace.members.find(m => m.userId === userId)
    if (!workspaceMembership) {
      return res.status(403).json({ error: 'You are not a member of this workspace' })
    }

    // Check if user is already member of channel
    const existingMembership = await db.channelMember.findFirst({
      where: {
        channelId: id,
        userId
      }
    })

    if (existingMembership) {
      return res.status(409).json({ error: 'You are already a member of this channel' })
    }

    // Add user to channel
    await db.channelMember.create({
      data: {
        channelId: id,
        userId
      }
    })

    logger.info(`User ${userId} joined channel ${id}`)

    res.json({ success: true, message: 'Joined channel successfully' })
  } catch (error) {
    logger.error('Join channel error:', error)
    res.status(500).json({ error: 'Failed to join channel' })
  }
})

// Leave channel
router.post('/:id/leave', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params
    const userId = req.user!.id

    // Check if user is member of channel
    const membership = await db.channelMember.findFirst({
      where: {
        channelId: id,
        userId
      }
    })

    if (!membership) {
      return res.status(404).json({ error: 'You are not a member of this channel' })
    }

    // Remove user from channel
    await db.channelMember.delete({
      where: {
        id: membership.id
      }
    })

    logger.info(`User ${userId} left channel ${id}`)

    res.json({ success: true, message: 'Left channel successfully' })
  } catch (error) {
    logger.error('Leave channel error:', error)
    res.status(500).json({ error: 'Failed to leave channel' })
  }
})

export default router