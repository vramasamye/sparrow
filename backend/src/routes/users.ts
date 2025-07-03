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
        avatar: true, // Ensure avatar is selected
        bio: true,    // Add bio
        jobTitle: true, // Add jobTitle
        pronouns: true, // Add pronouns
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
    const { name, username, bio, jobTitle, pronouns, avatar } = req.body // Added new fields

    // Basic validation (example for bio length)
    if (bio && bio.length > 500) { // Example length validation
        return res.status(400).json({ error: 'Bio cannot exceed 500 characters.' });
    }
    if (jobTitle && jobTitle.length > 100) {
        return res.status(400).json({ error: 'Job title cannot exceed 100 characters.' });
    }
    if (pronouns && pronouns.length > 50) {
        return res.status(400).json({ error: 'Pronouns cannot exceed 50 characters.' });
    }
    // Avatar URL validation could be added (e.g. is valid URL format, or just accept string)

    const updateData: any = {};

    // Only add fields to updateData if they are explicitly provided in the request body
    if (name !== undefined) updateData.name = name === "" ? null : name;
    if (bio !== undefined) updateData.bio = bio === "" ? null : bio;
    if (jobTitle !== undefined) updateData.jobTitle = jobTitle === "" ? null : jobTitle;
    if (pronouns !== undefined) updateData.pronouns = pronouns === "" ? null : pronouns;
    if (avatar !== undefined) updateData.avatar = avatar === "" ? null : avatar;

    // Check if username is already taken (if provided and different from current)
    if (username !== undefined) {
      const currentUser = await db.user.findUnique({ where: { id: userId }, select: { username: true } });
      if (!currentUser) return res.status(404).json({ error: 'User not found.' }); // Should not happen if authenticated

      if (currentUser.username !== username) {
        if (username === "") {
            return res.status(400).json({ error: 'Username cannot be empty.'});
        }
        const existingUserWithNewUsername = await db.user.findFirst({
          where: {
            username,
            NOT: { id: userId }
          }
        });
        if (existingUserWithNewUsername) {
          return res.status(409).json({ error: 'Username is already taken' });
        }
        updateData.username = username;
      }
    }

    if (Object.keys(updateData).length === 0) {
      // If only username was provided but it's the same as current, this would be empty.
      // Return current user profile or a specific message.
      const currentUserData = await db.user.findUnique({
        where: {id: userId},
        select: { id: true, username: true, name: true, email: true, avatar: true, bio: true, jobTitle: true, pronouns: true, createdAt: true }
      });
      return res.json({ user: currentUserData, message: "No changes detected or data provided." });
    }

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: updateData,
      select: { // Ensure all relevant fields are returned
        id: true,
        username: true,
        name: true,
        email: true,
        avatar: true,
        bio: true,
        jobTitle: true,
        pronouns: true,
        createdAt: true,
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