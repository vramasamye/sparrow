import { Router } from 'express';
import { db } from '../services/database';
import { AuthenticatedRequest } from '../types';
import { logger } from '../utils/logger';
import { MemberRole } from '@prisma/client'; // For type checking if needed, not strictly for this route yet

const router = Router();

// Define allowed notification settings for validation
const ALLOWED_NOTIFICATION_SETTINGS = ["ALL", "MENTIONS", "NONE"];

// Upsert User Notification Preference
// PUT /api/notification-preferences
router.put('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { workspaceId, channelId, setting } = req.body as {
      workspaceId: string;
      channelId?: string | null; // channelId can be explicitly null for workspace-level DM settings
      setting: string;
    };

    if (!workspaceId || !setting) {
      return res.status(400).json({ error: 'Workspace ID and notification setting are required.' });
    }

    if (!ALLOWED_NOTIFICATION_SETTINGS.includes(setting)) {
      return res.status(400).json({ error: `Invalid notification setting. Allowed values: ${ALLOWED_NOTIFICATION_SETTINGS.join(', ')}` });
    }

    // Verify user is a member of the workspace
    const workspaceMembership = await db.member.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } }
    });
    if (!workspaceMembership) {
      return res.status(403).json({ error: 'User is not a member of this workspace.' });
    }

    // If channelId is provided, verify user is a member of that channel
    if (channelId) {
      const channelMembership = await db.channelMember.findUnique({
        where: { channelId_userId: { channelId, userId } }
      });
      if (!channelMembership) {
        return res.status(403).json({ error: 'User is not a member of this channel.' });
      }
    }

    const preference = await db.userNotificationPreference.upsert({
      where: {
        userId_workspaceId_channelId: {
          userId,
          workspaceId,
          channelId: channelId || null, // Prisma expects null for optional unique fields not part of the key here
        }
      },
      update: { notificationSetting: setting },
      create: {
        userId,
        workspaceId,
        channelId: channelId || null,
        notificationSetting: setting,
      },
      include: { // Include related data if useful for client
        workspace: { select: { id: true, name: true } },
        channel: { select: { id: true, name: true } }
      }
    });

    logger.info(`User ${userId} preference updated for workspace ${workspaceId}, channel ${channelId || 'global'}: ${setting}`);
    res.status(200).json({ preference });

  } catch (error) {
    logger.error('Update notification preference error:', error);
    res.status(500).json({ error: 'Failed to update notification preference.' });
  }
});


// Get User Notification Preferences
// GET /api/notification-preferences?workspaceId=...&channelId=... (for specific channel)
// GET /api/notification-preferences?workspaceId=... (for workspace DM preference - where channelId is null)
// GET /api/notification-preferences?workspaceId=...&fetchAllForWorkspace=true (all channel prefs in workspace + DM pref)
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { workspaceId, channelId, fetchAllForWorkspace } = req.query as {
        workspaceId?: string;
        channelId?: string;
        fetchAllForWorkspace?: string;
    };

    if (!workspaceId) {
      return res.status(400).json({ error: 'Workspace ID is required.' });
    }

    // Verify user is a member of the workspace
    const workspaceMembership = await db.member.findUnique({
        where: { userId_workspaceId: { userId, workspaceId } }
    });
    if (!workspaceMembership) {
        return res.status(403).json({ error: 'User is not a member of this workspace.' });
    }

    let preferences;

    if (fetchAllForWorkspace === 'true') {
        // Fetch all preferences for the user in this workspace (DM + all channels they are in)
        preferences = await db.userNotificationPreference.findMany({
            where: { userId, workspaceId },
            include: { channel: {select: {id:true, name: true}}}
        });
    } else if (channelId) {
      // Fetch preference for a specific channel
      preferences = await db.userNotificationPreference.findUnique({
        where: { userId_workspaceId_channelId: { userId, workspaceId, channelId } },
      });
      if (!preferences) { // If no specific preference, could return a workspace default or system default
        return res.status(200).json({ preference: null, message: "No specific preference set for this channel." });
      }
    } else {
      // Fetch global DM preference for the workspace (where channelId is null)
      preferences = await db.userNotificationPreference.findUnique({
        where: { userId_workspaceId_channelId: { userId, workspaceId, channelId: null } },
      });
       if (!preferences) {
        return res.status(200).json({ preference: null, message: "No global DM preference set for this workspace." });
      }
    }

    res.status(200).json({ preferences });

  } catch (error) {
    logger.error('Get notification preferences error:', error);
    res.status(500).json({ error: 'Failed to fetch notification preferences.' });
  }
});


export default router;
