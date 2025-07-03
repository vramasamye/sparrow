import { Router } from 'express'
import { db } from '../services/database'
import { AuthenticatedRequest } from '../types'
import { logger } from '../utils/logger'

const router = Router()

// Helper function to parse mentions and create notifications
async function handleMentionsAndNotifications(message: any, senderId: string, workspaceId?: string, channelId?: string) {
  const content = message.content as string
  const mentionRegex = /@([\w.-]+)/g
  let match
  const mentionedUsernames: string[] = []
  while ((match = mentionRegex.exec(content)) !== null) {
    mentionedUsernames.push(match[1])
  }

  if (mentionedUsernames.length === 0) {
    return { mentionedUserIds: [] }
  }

  const users = await db.user.findMany({
    where: {
      username: { in: mentionedUsernames },
      // Optionally, filter by workspace members if workspaceId is available
      ...(workspaceId && { members: { some: { workspaceId } } }),
    },
    select: { id: true, username: true },
  })

  const mentionedUserIds = users.map(u => u.id)

  // Create notifications for mentioned users
  if (mentionedUserIds.length > 0) {
    const notifications = mentionedUserIds
      .filter(id => id !== senderId) // Don't notify self
      .map(userId => ({
        userId,
        type: 'mention',
        messageId: message.id,
        channelId: channelId,
        senderId,
      }))

    if (notifications.length > 0) {
      await db.notification.createMany({
        data: notifications,
      })
      // TODO: Emit socket event for new notifications to these users
    }
  }
  return { mentionedUserIds }
}


// Send message to channel
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { content, channelId, recipientId, parentId, attachmentIds } = req.body // Added attachmentIds
    const userId = req.user!.id

    if (!content && (!attachmentIds || attachmentIds.length === 0)) { // Message must have content or attachments
      return res.status(400).json({ error: 'Message content is required' })
    }

    if (!channelId && !recipientId) {
      return res.status(400).json({ error: 'Either channelId or recipientId is required' })
    }

    let createdMessageInTransaction: any; // Temporary variable within transaction
    let messageIdForRefetch: string | null = null;

    // Use a transaction to handle message creation and potential parent/thread updates
    await db.$transaction(async (prisma) => {
      let determinedThreadId: string | null = null;

      // 1. Initial message data
      const messageData: any = {
        content,
        userId,
        channelId: channelId || null,
        recipientId: recipientId || null,
        parentId: parentId || null,
        workspaceId: null, // Will be set for channel messages
      };

      if (channelId) {
        const channel = await prisma.channel.findUnique({ where: { id: channelId } });
        if (!channel) throw new Error('Channel not found');
        const membership = await prisma.channelMember.findFirst({ where: { channelId, userId } });
        if (!membership) throw new Error('User not member of channel');
        messageData.workspaceId = channel.workspaceId;
      }

      // Handle threading logic if parentId is provided
      if (parentId) {
        const parentMsg = await prisma.message.findUnique({ where: { id: parentId } });
        if (!parentMsg) throw new Error('Parent message not found');

        determinedThreadId = parentMsg.threadId || parentMsg.id; // If parent is root, its id is threadId
        messageData.threadId = determinedThreadId;

        // Update parent message's reply count
        await prisma.message.update({
          where: { id: parentId },
          data: {
            replyCount: { increment: 1 },
            lastReplyAt: new Date(), // Also update lastReplyAt on direct parent
           },
        });

        // If the parent message was the root of the thread, ensure its threadId is set
        if (!parentMsg.threadId) {
            await prisma.message.update({
                where: {id: parentMsg.id},
                data: { threadId: parentMsg.id }
            })
        }

        // Update the root message of the thread
        if (determinedThreadId) { // This will always be true if parentId is present
          await prisma.message.update({
            where: { id: determinedThreadId },
            data: {
                replyCount: { increment: 1 }, // Increment replyCount on the root of the thread
                lastReplyAt: new Date()
            },
          });
        }
      }

      // 2. Create the new message
      const newMessage = await prisma.message.create({
        data: messageData,
        include: { user: { select: { id: true, username: true, name: true } } },
      });

      // If it's a new top-level message, set its threadId to its own id
      if (!parentId) {
        await prisma.message.update({
          where: { id: newMessage.id },
          data: { threadId: newMessage.id },
        });
        // Refresh newMessage object to include this threadId
        createdMessageInTransaction = { ...newMessage, threadId: newMessage.id };
      } else {
        createdMessageInTransaction = newMessage;
      }

      // 3. Handle mentions (only for channel messages for now, or if DMs support workspace-wide mentions)
      if (createdMessageInTransaction.channelId) {
        const { mentionedUserIds } = await handleMentionsAndNotifications(
          createdMessageInTransaction,
          userId,
          messageData.workspaceId,
          createdMessageInTransaction.channelId
        );
        if (mentionedUserIds.length > 0) {
          createdMessageInTransaction = await prisma.message.update({ // Use prisma from transaction
            where: { id: createdMessageInTransaction.id },
            data: { mentionedUserIds: mentionedUserIds.join(',') },
            include: { user: { select: { id: true, username: true, name: true } } },
          });
        }
      }

      // 4. Create notification for direct message
      if (recipientId && userId !== recipientId) {
        await prisma.notification.create({
          data: {
            userId: recipientId,
            type: 'new_dm',
            messageId: createdMessageInTransaction.id,
            senderId: userId,
          },
        });
      }

      // 5. Link attachments if provided
      if (attachmentIds && attachmentIds.length > 0) {
        // Verify attachments exist, belong to the user, and are not already linked
        const attachmentsToLink = await prisma.attachment.findMany({
          where: {
            id: { in: attachmentIds as string[] },
            uploaderId: userId, // Ensure user owns the attachment
            messageId: null,    // Ensure not already linked
            // Optionally, check workspaceId if message is in a workspace-scoped channel
            ...(messageData.workspaceId && { workspaceId: messageData.workspaceId }),
          }
        });

        if (attachmentsToLink.length !== attachmentIds.length) {
          // Some attachments were not found, or don't belong to user, or already linked
          throw new Error('Invalid or already linked attachments provided.');
        }

        await prisma.attachment.updateMany({
          where: {
            id: { in: attachmentsToLink.map(att => att.id) }
          },
          data: {
            messageId: createdMessageInTransaction.id
          }
        });
      }
      messageIdForRefetch = createdMessageInTransaction.id; // Set ID for refetching

    }); // End of transaction

    if (!messageIdForRefetch) {
      throw new Error("Message creation failed within transaction.");
    }

    // Refetch the message outside transaction with all relations needed for response/socket
    const finalMessage = await db.message.findUnique({
        where: {id: messageIdForRefetch },
        include: {
            user: { select: { id: true, username: true, name: true, avatar: true } },
            parentMessage: { select: { id: true, userId: true, content: true, user: {select: {id: true, username: true, name: true}}}},
            attachments: { // Include attachments in the final response
              orderBy: { createdAt: 'asc' }
            }
        }
    })


    logger.info(`Message sent by ${req.user!.username} to ${channelId ? 'channel ' + channelId : 'user ' + recipientId}${parentId ? ` as reply to ${parentId}` : ''}`);
    res.status(201).json({ message: finalMessage });
  } catch (error) {
    logger.error('Send message error:', error)
    res.status(500).json({ error: 'Failed to send message' })
  }
})

// Get messages (channel or direct messages)
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { channelId, recipientId } = req.query
    const userId = req.user!.id
    const limit = parseInt(req.query.limit as string) || 50
    const offset = parseInt(req.query.offset as string) || 0

    let messages

    if (channelId) {
      // Channel messages
      // Check if user is member of channel
      const membership = await db.channelMember.findFirst({
        where: {
          channelId: channelId as string,
          userId
        }
      })

      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this channel' })
      }

      messages = await db.message.findMany({
        where: {
          channelId: channelId as string
        },
        include: {
          user: {
            select: { id: true, username: true, name: true, avatar: true } // Added avatar
          },
          reactions: { // Include reactions
            include: {
              user: { select: { id: true, username: true, name: true } } // User who made the reaction
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit,
        skip: offset
      })
    } else if (recipientId) {
      // Direct messages
      messages = await db.message.findMany({
        where: {
          OR: [
            {
              userId,
              recipientId: recipientId as string
            },
            {
              userId: recipientId as string,
              recipientId: userId
            }
          ]
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
    } else {
      return res.status(400).json({ error: 'Either channelId or recipientId is required' })
    }

    res.json({ messages: messages.reverse() })
  } catch (error) {
    logger.error('Get messages error:', error)
    res.status(500).json({ error: 'Failed to fetch messages' })
  }
})

// Delete message
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params
    const userId = req.user!.id

    const message = await db.message.findUnique({
      where: { id }
    })

    if (!message) {
      return res.status(404).json({ error: 'Message not found' })
    }

    // Check if user owns the message
    if (message.userId !== userId) {
      return res.status(403).json({ error: 'You can only delete your own messages' })
    }

    const originalMessageData = {
      id: message.id,
      channelId: message.channelId,
      recipientId: message.recipientId,
      userId: message.userId
    }

    await db.message.delete({
      where: { id }
    })

    // Emit socket event for message deletion
    const io = req.app.get('io')
    if (io) {
      if (originalMessageData.channelId) {
        io.to(`channel:${originalMessageData.channelId}`).emit('message_deleted', { id: originalMessageData.id, channelId: originalMessageData.channelId })
      } else if (originalMessageData.recipientId) {
        const userSocketsMap = req.app.get('userSockets') as Map<string, string> | undefined;
        const senderSocketId = userSocketsMap?.get(originalMessageData.userId)
        // Ensure recipientId is not null before trying to get its socket
        const recipientSocketId = originalMessageData.recipientId ? userSocketsMap?.get(originalMessageData.recipientId) : undefined

        const payload = {
            id: originalMessageData.id,
            recipientId: originalMessageData.recipientId,
            userId: originalMessageData.userId
        }
        if (senderSocketId) io.to(senderSocketId).emit('message_deleted', payload)
        if (recipientSocketId && recipientSocketId !== senderSocketId) {
            io.to(recipientSocketId).emit('message_deleted', payload)
        }
      }
    }

    logger.info(`Message ${id} deleted by ${req.user!.username}`)

    res.json({ success: true, message: 'Message deleted successfully' })
  } catch (error) {
    logger.error('Delete message error:', error)
    res.status(500).json({ error: 'Failed to delete message' })
  }
})

// Update message
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params
    const { content } = req.body
    const userId = req.user!.id

    if (!content) {
      return res.status(400).json({ error: 'Message content is required' })
    }

    const message = await db.message.findUnique({
      where: { id }
    })

    if (!message) {
      return res.status(404).json({ error: 'Message not found' })
    }

    // Check if user owns the message
    if (message.userId !== userId) {
      return res.status(403).json({ error: 'You can only edit your own messages' })
    }

    const updatedMessage = await db.message.update({
      where: { id },
      data: { content },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true
          }
        }
      }
    })

    // Emit socket event for message update
    const io = req.app.get('io')
    if (io) {
      if (updatedMessage.channelId) {
        io.to(`channel:${updatedMessage.channelId}`).emit('message_updated', updatedMessage)
      } else if (updatedMessage.recipientId) {
        // For DMs, send to both sender and recipient if they are online
        const senderSocketId = req.app.get('userSockets')?.get(updatedMessage.userId) // userSockets should be on app
        const recipientSocketId = req.app.get('userSockets')?.get(updatedMessage.recipientId)
        if (senderSocketId) io.to(senderSocketId).emit('message_updated', updatedMessage)
        if (recipientSocketId && recipientSocketId !== senderSocketId) io.to(recipientSocketId).emit('message_updated', updatedMessage)
      }
    }

    logger.info(`Message ${id} updated by ${req.user!.username}`)

    res.json({ message: updatedMessage })
  } catch (error) {
    logger.error('Update message error:', error)
    res.status(500).json({ error: 'Failed to update message' })
  }
})

// Get messages in a specific thread
router.get('/thread/:rootMessageId', async (req: AuthenticatedRequest, res) => {
  try {
    const { rootMessageId } = req.params;
    const userId = req.user!.id;

    // 1. Fetch the root message to verify its existence and get context (channel/DM)
    const rootMessage = await db.message.findUnique({
      where: { id: rootMessageId },
      include: {
        user: { select: { id: true, username: true, name: true, avatar: true } },
        channel: { select: { id: true, name: true, workspaceId: true } },
        reactions: { // Include reactions for the root message
          include: {
            user: { select: { id: true, username: true, name: true } }
          }
        }
        // parentMessage, replies, notifications are correctly set to false or not included
      }
    });

    if (!rootMessage) {
      return res.status(404).json({ error: 'Thread root message not found' });
    }

    // 2. Authorization Check: Ensure the current user can view this thread.
    // If it's a channel message, check channel membership.
    // If it's a DM, check if the user is either the sender or recipient of the root message.
    let authorized = false;
    if (rootMessage.channelId) {
      const membership = await db.channelMember.findFirst({
        where: { channelId: rootMessage.channelId, userId }
      });
      if (membership) authorized = true;
    } else if (rootMessage.recipientId) { // DM thread
      if (rootMessage.userId === userId || rootMessage.recipientId === userId) {
        authorized = true;
      }
    } else {
      // Should not happen if message is properly formed with either channelId or recipientId
      return res.status(500).json({ error: 'Invalid root message context' });
    }

    if (!authorized) {
      return res.status(403).json({ error: 'You are not authorized to view this thread' });
    }

    // 3. Fetch all messages belonging to this thread
    const threadMessages = await db.message.findMany({
      where: {
        threadId: rootMessageId,
        id: { not: rootMessageId } // Exclude the root message itself from this list, as we already have it
      },
      include: {
        user: { select: { id: true, username: true, name: true, avatar: true } },
        reactions: { // Include reactions for each reply
          include: {
            user: { select: { id: true, username: true, name: true } }
          }
        }
        // parentMessage: { select: { id: true, userId: true, user: {select: {username:true}}}},
      },
      orderBy: {
        createdAt: 'asc' // Replies should be in chronological order
      }
    });

    res.json({ rootMessage, replies: threadMessages });

  } catch (error) {
    logger.error('Get thread messages error:', error);
    res.status(500).json({ error: 'Failed to fetch thread messages' });
  }
});

// Mount reaction routes nested under /:messageId/reactions
import reactionRoutes from './reactions'; // Import here
router.use('/:messageId/reactions', reactionRoutes);


export default router