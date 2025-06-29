import { Router } from 'express'
import { db } from '../services/database'
import { AuthenticatedRequest } from '../types'
import { logger } from '../utils/logger'

const router = Router()

// Search users
router.get('/search', async (req: AuthenticatedRequest, res) => {
  try {
    const { q, workspaceId } = req.query
    const userId = req.user!.id

    if (!q) {
      return res.status(400).json({ error: 'Search query is required' })
    }

    let users

    if (workspaceId) {
      // Search users within a specific workspace
      // First check if current user is member of the workspace
      const membership = await db.member.findFirst({
        where: {
          workspaceId: workspaceId as string,
          userId
        }
      })

      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this workspace' })
      }

      users = await db.user.findMany({
        where: {
          AND: [
            {
              OR: [
                { username: { contains: q as string, mode: 'insensitive' } },
                { name: { contains: q as string, mode: 'insensitive' } },
                { email: { contains: q as string, mode: 'insensitive' } }
              ]
            },
            {
              members: {
                some: {
                  workspaceId: workspaceId as string
                }
              }
            }
          ]
        },
        select: {
          id: true,
          username: true,
          name: true,
          email: true
        },
        take: 20
      })
    } else {
      // Global user search
      users = await db.user.findMany({
        where: {
          OR: [
            { username: { contains: q as string, mode: 'insensitive' } },
            { name: { contains: q as string, mode: 'insensitive' } },
            { email: { contains: q as string, mode: 'insensitive' } }
          ]
        },
        select: {
          id: true,
          username: true,
          name: true,
          email: true
        },
        take: 20
      })
    }

    res.json({ users })
  } catch (error) {
    logger.error('Search users error:', error)
    res.status(500).json({ error: 'Failed to search users' })
  }
})

// Get user profile
router.get('/profile', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        createdAt: true,
        members: {
          include: {
            workspace: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({ user })
  } catch (error) {
    logger.error('Get user profile error:', error)
    res.status(500).json({ error: 'Failed to fetch user profile' })
  }
})

// Update user profile
router.put('/profile', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id
    const { name, username } = req.body

    // Check if username is already taken (if provided)
    if (username) {
      const existingUser = await db.user.findFirst({
        where: {
          username,
          NOT: {
            id: userId
          }
        }
      })

      if (existingUser) {
        return res.status(409).json({ error: 'Username is already taken' })
      }
    }

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: {
        ...(name && { name }),
        ...(username && { username })
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true
      }
    })

    logger.info(`User profile updated: ${updatedUser.username}`)

    res.json({ user: updatedUser })
  } catch (error) {
    logger.error('Update user profile error:', error)
    res.status(500).json({ error: 'Failed to update user profile' })
  }
})

// Get user's direct message conversations
router.get('/conversations', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id

    // Get all unique users that current user has exchanged messages with
    const conversations = await db.user.findMany({
      where: {
        OR: [
          {
            sentMessages: {
              some: {
                recipientId: userId
              }
            }
          },
          {
            receivedMessages: {
              some: {
                userId
              }
            }
          }
        ]
      },
      select: {
        id: true,
        username: true,
        name: true
      }
    })

    // Get the latest message for each conversation
    const conversationsWithLastMessage = await Promise.all(
      conversations.map(async (user) => {
        const lastMessage = await db.message.findFirst({
          where: {
            OR: [
              {
                userId,
                recipientId: user.id
              },
              {
                userId: user.id,
                recipientId: userId
              }
            ]
          },
          orderBy: {
            createdAt: 'desc'
          },
          include: {
            user: {
              select: {
                username: true
              }
            }
          }
        })

        return {
          user,
          lastMessage
        }
      })
    )

    // Sort by last message timestamp
    conversationsWithLastMessage.sort((a, b) => {
      if (!a.lastMessage) return 1
      if (!b.lastMessage) return -1
      return new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
    })

    res.json({ conversations: conversationsWithLastMessage })
  } catch (error) {
    logger.error('Get conversations error:', error)
    res.status(500).json({ error: 'Failed to fetch conversations' })
  }
})

export default router