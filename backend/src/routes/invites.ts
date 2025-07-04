import { Router } from 'express';
import { db } from '../services/database';
import { logger } from '../utils/logger';
import { MemberRole } from '@prisma/client';

const router = Router();

// GET /api/invites/:token - Fetch details of an invite (unauthenticated)
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: 'Invite token is required.' });
    }

    const invite = await db.workspaceInvite.findUnique({
      where: { token },
      include: {
        workspace: { select: { id: true, name: true } }, // Need workspaceId for acceptance later by logged-in user
        invitedBy: { select: { username: true, name: true } },
      },
    });

    if (!invite) {
      return res.status(404).json({ error: 'Invite not found or invalid.' });
    }

    // Validate invite
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      return res.status(410).json({ error: 'This invite link has expired.' }); // 410 Gone
    }
    if (invite.maxUses !== null && invite.uses >= invite.maxUses) {
      return res.status(410).json({ error: 'This invite link has reached its maximum number of uses.' });
    }

    // Return public-safe details
    res.json({
      workspaceId: invite.workspaceId, // Needed by client if user logs in/signs up then accepts
      workspaceName: invite.workspace.name,
      invitedBy: invite.invitedBy.name || invite.invitedBy.username,
      roleToBeGranted: invite.role,
      // Optionally, can send email if invite was email-specific and client wants to prefill
      // email: invite.email
    });

  } catch (error) {
    logger.error(`Fetch invite details error for token ${req.params.token}:`, error);
    res.status(500).json({ error: 'Failed to fetch invite details.' });
  }
});

// POST /api/invites/:token/accept - Accept an invite (authenticated)
// Note: authMiddleware needs to be applied to this route in server.ts or here.
// For now, assuming authMiddleware is applied at a higher level for /api routes
// or would be added like: router.post('/:token/accept', authMiddlewareFromExpress, async (req: AuthenticatedRequest, res) => {
// Let's assume AuthenticatedRequest correctly populates req.user from a general auth middleware.
router.post('/:token/accept', async (req: AuthenticatedRequest, res) => {
  try {
    const { token } = req.params;
    const userId = req.user!.id; // From authMiddleware
    const userEmail = req.user!.email; // From authMiddleware

    if (!token) {
      return res.status(400).json({ error: 'Invite token is required.' });
    }

    const invite = await db.workspaceInvite.findUnique({
      where: { token },
      include: { workspace: true } // Need workspace to add member to
    });

    if (!invite) {
      return res.status(404).json({ error: 'Invite not found or invalid.' });
    }

    // Validate invite
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      return res.status(410).json({ error: 'This invite link has expired.' });
    }
    if (invite.maxUses !== null && invite.uses >= invite.maxUses) {
      return res.status(410).json({ error: 'This invite link has reached its maximum number of uses.' });
    }
    if (invite.email && invite.email.toLowerCase() !== userEmail.toLowerCase()) {
      return res.status(403).json({ error: 'This invite is for a different email address.' });
    }

    // Check if user is already a member
    const existingMembership = await db.member.findUnique({
      where: { userId_workspaceId: { userId, workspaceId: invite.workspaceId } },
    });

    if (existingMembership) {
      // User is already a member. Could update role if invite role is higher, or just confirm.
      // For now, just confirm membership.
      logger.info(`User ${userId} attempted to accept invite ${token} for workspace ${invite.workspaceId} but is already a member.`);
      return res.status(200).json({
        message: 'You are already a member of this workspace.',
        workspace: { id: invite.workspace.id, name: invite.workspace.name }
      });
    }

    // Add user to workspace and increment invite uses in a transaction
    await db.$transaction(async (prisma) => {
      await prisma.member.create({
        data: {
          userId,
          workspaceId: invite.workspaceId,
          role: invite.role,
        },
      });

      await prisma.workspaceInvite.update({
        where: { id: invite.id },
        data: { uses: { increment: 1 } },
      });

      // Add user to the 'general' channel of that workspace
      const generalChannel = await prisma.channel.findFirst({
        where: { workspaceId: invite.workspaceId, name: 'general' },
      });

      if (generalChannel) {
        // Check if already member of general channel (should not be if new to workspace)
        const existingChannelMembership = await prisma.channelMember.findFirst({
            where: { channelId: generalChannel.id, userId }
        });
        if (!existingChannelMembership) {
            await prisma.channelMember.create({
                data: { channelId: generalChannel.id, userId },
            });
        }
      }
    });

    logger.info(`User ${userId} accepted invite ${token} and joined workspace ${invite.workspaceId} as ${invite.role}.`);
    res.status(200).json({
      message: `Successfully joined workspace "${invite.workspace.name}" as a ${invite.role}.`,
      workspace: { id: invite.workspace.id, name: invite.workspace.name }
    });

  } catch (error) {
    logger.error(`Accept invite error for token ${req.params.token} by user ${req.user?.id}:`, error);
    res.status(500).json({ error: 'Failed to accept invite.' });
  }
});


export default router;
