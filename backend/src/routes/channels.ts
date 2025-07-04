import { Router } from 'express'
import { db } from '../services/database'
import { AuthenticatedRequest } from '../types'
import { logger } from '../utils/logger'
import { roleCheckMiddleware } from '../middleware/auth' // Import
import { MemberRole } from '@prisma/client' // Import

const router = Router({ mergeParams: true }) // Enable mergeParams

// Create channel - ADMIN or MEMBER
router.post('/', roleCheckMiddleware([MemberRole.ADMIN, MemberRole.MEMBER]), async (req: AuthenticatedRequest, res) => {
  try {
    const { name, description, isPrivate } = req.body;
    const { workspaceId } = req.params; // Get workspaceId from route params
    const userId = req.user!.id;

    if (!name) { // workspaceId is now from params, so only name needs validation from body
      return res.status(400).json({ error: 'Channel name is required' });
    }

    // User membership and role (ADMIN/MEMBER) already validated by authMiddleware & roleCheckMiddleware
    // No need for: const membership = await db.member.findFirst(...)

    // Check if channel name already exists in workspace
    const existingChannel = await db.channel.findFirst({
      where: {
        workspaceId, // Use workspaceId from params
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

// Get all members of a specific channel
router.get('/:channelId/members', async (req: AuthenticatedRequest, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.user!.id;

    // 1. Authorization: Check if the current user is a member of this channel
    const currentUserMembership = await db.channelMember.findUnique({
      where: {
        channelId_userId: { // Prisma unique constraint name: @@unique([channelId, userId])
          channelId,
          userId,
        },
      },
    });

    if (!currentUserMembership) {
      // Alternative: Could also allow workspace admins to see members of any channel in their workspace.
      // For now, strict channel membership is required to view members.
      return res.status(403).json({ error: 'You are not a member of this channel and cannot view its members.' });
    }

    // 2. Fetch all members of the channel
    const members = await db.channelMember.findMany({
      where: { channelId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            // Optionally, include their workspace role if needed for display context
            // This would require fetching their Member record for the channel's workspace.
            // For simplicity, just user details for now.
          },
        },
      },
      orderBy: {
        joinedAt: 'asc', // Or by username, etc.
      },
    });

    // Map to a slightly cleaner structure if desired, or return as is.
    // e.g., res.json({ members: members.map(m => m.user) });
    // But returning full ChannelMember with nested user is also fine.
    res.json({ members });

  } catch (error) {
    logger.error(`Get channel members error for channel ${req.params.channelId}:`, error);
    res.status(500).json({ error: 'Failed to fetch channel members.' });
  }
});

// Remove a user from a channel
// DELETE /api/(workspaces/:workspaceId)/channels/:channelId/members/:targetUserId
router.delete('/:channelId/members/:targetUserId', roleCheckMiddleware([MemberRole.ADMIN]), async (req: AuthenticatedRequest, res) => {
  // Only Workspace ADMINs can use this endpoint to remove others.
  // Users can remove themselves using POST /:channelId/leave
  try {
    const { channelId, targetUserId } = req.params;
    const currentUserId = req.user!.id; // This is the admin performing the action

    if (currentUserId === targetUserId) {
      return res.status(400).json({ error: 'Admin cannot remove themselves using this endpoint. Use "Leave Channel" instead.' });
    }

    // 1. Fetch channel and target member details
    const channel = await db.channel.findUnique({ where: { id: channelId } });
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found.' });
    }

    const targetMembership = await db.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId: targetUserId } },
      include: { user: { select: { id: true, username: true, name: true } } }
    });

    if (!targetMembership) {
      return res.status(404).json({ error: 'Target user is not a member of this channel.' });
    }

    // 2. Additional Safeguards (optional, can be more complex)
    // - Prevent removing the channel creator if they are the last member?
    // - Prevent removing workspace owner? (owner should always have access or leave by choice)
    // For now, an ADMIN can remove anyone except themselves via this route.
    // The workspace owner cannot be removed from the workspace itself, but can be removed from channels by another admin.

    // 3. Remove user from channel
    await db.channelMember.delete({
      where: { channelId_userId: { channelId, userId: targetUserId } }
    });

    // 4. Emit socket events
    const io = req.app.get('io');
    if (io) {
      io.to(`channel:${channelId}`).emit('user_removed_from_channel', {
        channelId,
        userId: targetUserId, // User who was removed
        removedByUserId: currentUserId
      });

      const targetUserSocketId = (req.app.get('userSockets') as Map<string,string>).get(targetUserId);
      if (targetUserSocketId) {
        io.to(targetUserSocketId).emit('removed_from_channel', {
          channelId,
          channelName: channel.name,
          workspaceId: channel.workspaceId,
          removedByUsername: req.user!.username
        });
      }
    }

    logger.info(`User ${targetUserId} removed from channel ${channelId} by admin ${currentUserId}`);
    res.status(200).json({ success: true, message: 'User removed from channel successfully.' });

  } catch (error) {
    logger.error(`Remove member from channel error for channel ${req.params.channelId}, user ${req.params.targetUserId}:`, error);
    res.status(500).json({ error: 'Failed to remove member from channel.' });
  }
});

// Add a user to a channel
// POST /api/(workspaces/:workspaceId)/channels/:channelId/members
router.post('/:channelId/members', async (req: AuthenticatedRequest, res) => {
  try {
    const { channelId } = req.params;
    const { userId: targetUserId } = req.body; // ID of the user to add
    const currentUserId = req.user!.id;
    const currentUserRole = req.user!.currentWorkspaceRole; // From authMiddleware

    if (!targetUserId) {
      return res.status(400).json({ error: 'User ID to add is required.' });
    }

    // 1. Fetch channel details
    const channel = await db.channel.findUnique({
      where: { id: channelId },
      select: { id: true, name: true, isPrivate: true, workspaceId: true }
    });

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found.' });
    }

    // Ensure current user is part of the workspace (implicit by currentWorkspaceRole if not null)
    if (!currentUserRole) {
        return res.status(403).json({ error: 'You are not a member of this workspace.'});
    }

    // 2. Permission Check for current user
    let canAddMember = false;
    if (currentUserRole === MemberRole.ADMIN) {
      canAddMember = true;
    } else if (!channel.isPrivate) { // Public channel
      // Any member of a public channel can add another workspace member
      const currentUserChannelMembership = await db.channelMember.findUnique({
        where: { channelId_userId: { channelId, userId: currentUserId } }
      });
      if (currentUserChannelMembership) {
        canAddMember = true;
      }
    }
    // Private channels: only ADMINs can add (for now)

    if (!canAddMember) {
      return res.status(403).json({ error: 'You do not have permission to add members to this channel.' });
    }

    // 3. Check if targetUser is a member of the workspace
    const targetUserWorkspaceMembership = await db.member.findUnique({
      where: { userId_workspaceId: { userId: targetUserId, workspaceId: channel.workspaceId } }
    });
    if (!targetUserWorkspaceMembership) {
      return res.status(404).json({ error: 'User to add is not a member of this workspace.' });
    }

    // 4. Check if targetUser is already a member of the channel
    const existingChannelMembership = await db.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId: targetUserId } }
    });
    if (existingChannelMembership) {
      return res.status(409).json({ error: 'User is already a member of this channel.' });
    }

    // 5. Add user to channel
    const newChannelMember = await db.channelMember.create({
      data: { channelId, userId: targetUserId },
      include: { user: { select: { id: true, username: true, name: true, avatar: true } } }
    });

    // 6. Emit socket events
    const io = req.app.get('io');
    if (io) {
      const eventPayload = {
        channelId,
        userId: newChannelMember.userId,
        addedByUserId: currentUserId,
        userDetails: newChannelMember.user
      };
      io.to(`channel:${channelId}`).emit('user_added_to_channel', eventPayload);

      const targetUserSocketId = (req.app.get('userSockets') as Map<string,string>).get(targetUserId);
      if (targetUserSocketId) {
        io.to(targetUserSocketId).emit('added_to_channel', {
          channelId,
          channelName: channel.name,
          workspaceId: channel.workspaceId,
          addedByUsername: req.user!.username
        });
      }
    }

    logger.info(`User ${targetUserId} added to channel ${channelId} by ${currentUserId}`);
    res.status(201).json({ member: newChannelMember });

  } catch (error) {
    logger.error(`Add member to channel error for channel ${req.params.channelId}:`, error);
    res.status(500).json({ error: 'Failed to add member to channel.' });
  }
});


export default router