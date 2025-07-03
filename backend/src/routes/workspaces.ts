import { Router } from 'express'
import { db } from '../services/database'
import { AuthenticatedRequest } from '../types'
import { logger } from '../utils/logger'
import { roleCheckMiddleware } from '../middleware/auth' // Import roleCheckMiddleware
import { MemberRole } from '@prisma/client' // Import MemberRole

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
router.get('/:workspaceId', async (req: AuthenticatedRequest, res) => { // Changed :id to :workspaceId
  try {
    const { workspaceId } = req.params; // Changed id to workspaceId
    const userId = req.user!.id

    const workspace = await db.workspace.findFirst({
      where: {
        id: workspaceId, // Use workspaceId here
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

// Update workspace details - ADMIN only
router.put('/:workspaceId', roleCheckMiddleware([MemberRole.ADMIN]), async (req: AuthenticatedRequest, res) => {
  // :workspaceId is now in req.params.workspaceId due to authMiddleware
  try {
    const { workspaceId } = req.params; // Correctly access workspaceId
    const { name, description } = req.body;
    const userId = req.user!.id;

    if (!name && description === undefined) {
      return res.status(400).json({ error: 'Name or description is required to update.' });
    }

    // The roleCheckMiddleware already confirmed the user is an ADMIN of this workspace.
    // No need to re-fetch membership for role check here.

    const workspace = await db.workspace.update({
      where: { id: workspaceId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
      },
      // Include what's necessary for the response
      include: { members: { include: { user: {select: {id: true, username: true, name: true}}}}, channels: {select: {id: true, name: true}} }
    });

    logger.info(`Workspace ${workspace.name} updated by admin ${req.user!.username}`);
    res.json({ workspace });
  } catch (error) {
    logger.error(`Update workspace error for ID ${req.params.workspaceId}:`, error);
    res.status(500).json({ error: 'Failed to update workspace' });
  }
});

// Delete workspace - ADMIN only
router.delete('/:workspaceId', roleCheckMiddleware([MemberRole.ADMIN]), async (req: AuthenticatedRequest, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user!.id;

    // Add additional check: only owner can delete? Or any admin?
    // For now, any ADMIN of this workspace can delete.
    // Ensure cascading deletes are set up correctly in Prisma schema for members, channels, messages etc.
    // (They are: Member, Channel, Message have onDelete: Cascade for workspaceId)

    // It's good practice to ensure the workspace exists before attempting delete,
    // though Prisma will error if it doesn't.
    const workspace = await db.workspace.findUnique({ where: {id: workspaceId }});
    if (!workspace) {
        return res.status(404).json({ error: "Workspace not found."});
    }
    // Check if user is the owner, for extra safety, though ADMIN role check is primary here.
    // if (workspace.ownerId !== userId) {
    //     return res.status(403).json({ error: "Only the workspace owner can delete the workspace." });
    // }


    await db.workspace.delete({
      where: { id: workspaceId },
    });

    logger.info(`Workspace ${workspaceId} deleted by admin ${req.user!.username}`);
    res.status(200).json({ success: true, message: 'Workspace deleted successfully' });
  } catch (error) {
    logger.error(`Delete workspace error for ID ${req.params.workspaceId}:`, error);
    res.status(500).json({ error: 'Failed to delete workspace' });
  }
});


// Invite user to workspace - ADMIN only
router.post('/:workspaceId/invite', roleCheckMiddleware([MemberRole.ADMIN]), async (req: AuthenticatedRequest, res) => {
  // Path param is now :workspaceId
  try {
    const { workspaceId } = req.params; // Use workspaceId from params
    const { email } = req.body;
    // const userId = req.user!.id; // Current user's ID, already confirmed as ADMIN by middleware

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // No need to re-check if user is admin, roleCheckMiddleware handles it.
    // const membership = await db.member.findFirst({ ... }) // This check is removed

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

// Update a member's role in a workspace - ADMIN only
router.put('/:workspaceId/members/:targetUserId/role', roleCheckMiddleware([MemberRole.ADMIN]), async (req: AuthenticatedRequest, res) => {
  try {
    const { workspaceId, targetUserId } = req.params;
    const { role: newRole } = req.body as { role: MemberRole };
    const currentUserId = req.user!.id;

    // Validate the new role
    if (!newRole || !Object.values(MemberRole).includes(newRole)) {
      return res.status(400).json({ error: 'Invalid role provided.' });
    }

    // Fetch the target member
    const targetMember = await db.member.findUnique({
      where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
      include: { workspace: { select: { ownerId: true } } } // Need ownerId for safeguard checks
    });

    if (!targetMember) {
      return res.status(404).json({ error: 'Target user is not a member of this workspace.' });
    }

    // Safeguard: Prevent changing the workspace owner's role by other admins (owner must do it or be deleted/transferred)
    // For simplicity, let's say owner's role cannot be changed via this endpoint at all by others.
    // Owner can change their own role if they are not the last admin (covered next).
    if (targetMember.userId === targetMember.workspace.ownerId && currentUserId !== targetMember.userId) {
        return res.status(403).json({ error: "Workspace owner's role cannot be changed by other admins." });
    }

    // Safeguard: Prevent self-demotion if current user is the last admin
    if (currentUserId === targetUserId && targetMember.role === MemberRole.ADMIN && newRole !== MemberRole.ADMIN) {
      const adminCount = await db.member.count({
        where: { workspaceId, role: MemberRole.ADMIN },
      });
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Cannot demote the last admin of the workspace.' });
      }
    }

    // Safeguard: Prevent demoting any user from ADMIN if they are the workspace owner and this would leave no admins
    // This is partially covered by the "last admin" check if the owner is the one being demoted.
    // If demoting *another* admin, and that admin is the owner, and there are no other admins, that's also an issue.
    // For now, the "last admin" check is the primary safeguard. A more complex "owner must remain admin or transfer ownership"
    // is out of scope for this iteration.

    const updatedMember = await db.member.update({
      where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
      data: { role: newRole },
      include: { user: { select: { id: true, username: true, name: true, email: true } } }
    });

    logger.info(`User ${targetUserId} role updated to ${newRole} in workspace ${workspaceId} by admin ${currentUserId}`);
    res.json({ member: updatedMember });

  } catch (error) {
    logger.error(`Update member role error for user ${req.params.targetUserId} in workspace ${req.params.workspaceId}:`, error);
    res.status(500).json({ error: 'Failed to update member role.' });
  }
});


export default router