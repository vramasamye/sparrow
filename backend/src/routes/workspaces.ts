import { Router } from 'express'
import { db } from '../services/database'
import { AuthenticatedRequest } from '../types'
import { logger } from '../utils/logger'

const router = Router()

// Get user's workspaces
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id

    const workspaces = await db.workspace.findMany({
      where: {
        members: {
          some: {
            userId
          }
        }
      },
      include: {
        channels: {
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
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    })

    res.json({ workspaces })
  } catch (error) {
    logger.error('Get workspaces error:', error)
    res.status(500).json({ error: 'Failed to fetch workspaces' })
  }
})

// Get specific workspace
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params
    const userId = req.user!.id

    const workspace = await db.workspace.findFirst({
      where: {
        id,
        members: {
          some: {
            userId
          }
        }
      },
      include: {
        channels: {
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
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    })

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' })
    }

    res.json({ workspace })
  } catch (error) {
    logger.error('Get workspace error:', error)
    res.status(500).json({ error: 'Failed to fetch workspace' })
  }
})

// Create workspace
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { name, description } = req.body
    const userId = req.user!.id

    if (!name) {
      return res.status(400).json({ error: 'Workspace name is required' })
    }

    const workspace = await db.workspace.create({
      data: {
        name,
        description,
        ownerId: userId,
        members: {
          create: {
            userId,
            role: 'ADMIN'
          }
        },
        channels: {
          create: {
            name: 'general',
            description: 'General discussion',
            isPrivate: false,
            createdBy: userId,
            members: {
              create: {
                userId
              }
            }
          }
        }
      },
      include: {
        channels: true,
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    })

    logger.info(`Workspace created: ${workspace.name} by ${req.user!.username}`)

    res.status(201).json({ workspace })
  } catch (error) {
    logger.error('Create workspace error:', error)
    res.status(500).json({ error: 'Failed to create workspace' })
  }
})

// Invite user to workspace
router.post('/:id/invite', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params
    const { email } = req.body
    const userId = req.user!.id

    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }

    // Check if user is admin of workspace
    const membership = await db.member.findFirst({
      where: {
        workspaceId: id,
        userId,
        role: 'ADMIN'
      }
    })

    if (!membership) {
      return res.status(403).json({ error: 'Only workspace admins can invite users' })
    }

    // Find user to invite
    const userToInvite = await db.user.findUnique({
      where: { email }
    })

    if (!userToInvite) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Check if user is already a member
    const existingMembership = await db.member.findFirst({
      where: {
        workspaceId: id,
        userId: userToInvite.id
      }
    })

    if (existingMembership) {
      return res.status(409).json({ error: 'User is already a member of this workspace' })
    }

    // Add user to workspace
    await db.member.create({
      data: {
        workspaceId: id,
        userId: userToInvite.id,
        role: 'MEMBER'
      }
    })

    // Add user to general channel
    const generalChannel = await db.channel.findFirst({
      where: {
        workspaceId: id,
        name: 'general'
      }
    })

    if (generalChannel) {
      await db.channelMember.create({
        data: {
          channelId: generalChannel.id,
          userId: userToInvite.id
        }
      })
    }

    logger.info(`User ${userToInvite.username} invited to workspace ${id}`)

    res.json({ 
      success: true, 
      message: 'User invited successfully',
      user: {
        id: userToInvite.id,
        username: userToInvite.username,
        name: userToInvite.name,
        email: userToInvite.email
      }
    })
  } catch (error) {
    logger.error('Invite user error:', error)
    res.status(500).json({ error: 'Failed to invite user' })
  }
})

export default router