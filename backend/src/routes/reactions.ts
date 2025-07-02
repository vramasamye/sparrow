import { Router } from 'express';
import { db } from '../services/database';
import { AuthenticatedRequest } from '../types';
import { logger } from '../utils/logger';

const router = Router({ mergeParams: true }); // mergeParams allows access to :messageId from parent router

// Helper to get aggregated reactions for a message
async function getAggregatedReactions(messageId: string) {
  const reactions = await db.reaction.findMany({
    where: { messageId },
    include: { user: { select: { id: true, username: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  });

  // Aggregate reactions
  const aggregated = reactions.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = {
        emoji: reaction.emoji,
        count: 0,
        users: [],
      };
    }
    acc[reaction.emoji].count++;
    acc[reaction.emoji].users.push(reaction.user);
    return acc;
  }, {} as Record<string, { emoji: string; count: number; users: any[] }>);

  return Object.values(aggregated);
}


// Add a reaction to a message
// POST /api/messages/:messageId/reactions
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user!.id;

    if (!emoji) {
      return res.status(400).json({ error: 'Emoji is required' });
    }

    // Check if message exists and user can access it (e.g. member of channel/DM)
    const message = await db.message.findUnique({ where: { id: messageId } });
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    // TODO: Add authorization check - user must be able to see the message to react.
    // For now, assume if they have messageId, they can see it.

    // Upsert logic: if reaction exists by user for this emoji, do nothing (or could be toggle)
    // For now, try to create, and catch unique constraint violation if it's a duplicate.
    let newReaction;
    try {
      newReaction = await db.reaction.create({
        data: {
          emoji,
          messageId,
          userId,
        },
        include: { user: { select: { id: true, username: true, name: true } } }
      });
    } catch (e: any) {
      if (e.code === 'P2002') { // Prisma unique constraint violation
        // User already reacted with this emoji. Fetch existing.
        const existingReaction = await db.reaction.findUnique({
          where: { emoji_messageId_userId: { emoji, messageId, userId } },
          include: { user: { select: { id: true, username: true, name: true } } }
        });
        if (existingReaction) {
           // Optionally, could return 200 OK with existing if we don't want to signal "already exists" as an error.
           // For now, we treat it as "reaction is there", so we'll proceed to get aggregated list.
        } else {
            throw e; // Re-throw if it's not the expected unique constraint error or if findUnique fails.
        }
      } else {
        throw e; // Re-throw other errors
      }
    }

    const rawReactions = await db.reaction.findMany({
        where: { messageId },
        include: { user: { select: { id: true, username: true, name: true }}},
        orderBy: { createdAt: 'asc' }
    });
    const displayAggregatedReactions = await getAggregatedReactions(messageId); // For API response

    const io = req.app.get('io');
    if (io && message) {
        const room = message.channelId ? `channel:${message.channelId}` : null;
        if (room) {
            io.to(room).emit('reaction_updated', { messageId, reactions: rawReactions }); // Emit raw reactions
        } else if (message.recipientId && message.userId) { // DM
            const userSocketsMap = req.app.get('userSockets') as Map<string, string> | undefined;
            const socket1 = userSocketsMap?.get(message.userId);
            const socket2 = userSocketsMap?.get(message.recipientId);
            if(socket1) io.to(socket1).emit('reaction_updated', { messageId, reactions: rawReactions });
            if(socket2 && socket1 !== socket2) io.to(socket2).emit('reaction_updated', { messageId, reactions: rawReactions });
        }
    }
    // API response can still send aggregated for immediate feedback to the actor,
    // but socket sends raw for consistent state update across clients.
    res.status(201).json({ reactions: displayAggregatedReactions, addedReaction: newReaction });

  } catch (error: any) {
    logger.error('Add reaction error:', error);
    if (error.code === 'P2002') { // Handle unique constraint violation gracefully if not caught above
        return res.status(409).json({ error: 'You have already reacted with this emoji.' });
    }
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

// Remove a reaction from a message
// DELETE /api/messages/:messageId/reactions/:emoji
router.delete('/:emoji', async (req: AuthenticatedRequest, res) => {
  try {
    const { messageId, emoji: encodedEmoji } = req.params;
    const emoji = decodeURIComponent(encodedEmoji); // Emojis in URL might be encoded
    const userId = req.user!.id;

    const reaction = await db.reaction.findUnique({
      where: {
        emoji_messageId_userId: {
          emoji,
          messageId,
          userId,
        },
      },
    });

    if (!reaction) {
      return res.status(404).json({ error: 'Reaction not found or you did not add this reaction.' });
    }

    // Ensure user owns the reaction (already implicitly handled by unique constraint query but good for clarity)
    // if (reaction.userId !== userId) {
    //   return res.status(403).json({ error: 'You can only remove your own reactions.' });
    // }

    await db.reaction.delete({
      where: {
        id: reaction.id, // Use the actual ID of the reaction for deletion
      },
    });

    const rawReactions = await db.reaction.findMany({
        where: { messageId },
        include: { user: { select: { id: true, username: true, name: true }}},
        orderBy: { createdAt: 'asc' }
    });
    const displayAggregatedReactions = await getAggregatedReactions(messageId); // For API response

    const message = await db.message.findUnique({ where: { id: messageId } }); // Need message for context
    const io = req.app.get('io');
     if (io && message) {
        const room = message.channelId ? `channel:${message.channelId}` : null;
        if (room) {
            io.to(room).emit('reaction_updated', { messageId, reactions: rawReactions }); // Emit raw reactions
        } else if (message.recipientId && message.userId) { // DM
            const userSocketsMap = req.app.get('userSockets') as Map<string, string> | undefined;
            const socket1 = userSocketsMap?.get(message.userId);
            const socket2 = userSocketsMap?.get(message.recipientId);
            if(socket1) io.to(socket1).emit('reaction_updated', { messageId, reactions: rawReactions });
            if(socket2 && socket1 !== socket2) io.to(socket2).emit('reaction_updated', { messageId, reactions: rawReactions });
        }
    }

    res.status(200).json({ reactions: displayAggregatedReactions });

  } catch (error) {
    logger.error('Remove reaction error:', error);
    res.status(500).json({ error: 'Failed to remove reaction' });
  }
});

export default router;
