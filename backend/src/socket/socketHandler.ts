import { Server, Socket } from 'socket.io'
import { verifyToken } from '../utils/jwt'
import { logger } from '../utils/logger'
import { db } from '../services/database'
import { SocketUser, TypingData, MessageData } from '../types'

// Store connected users
const connectedUsers = new Map<string, SocketUser>()
import { Express } from 'express'; // Import Express type

    // const userSockets = new Map<string, string>() // userId -> socketId - This will be managed on app instance


// Helper function to parse mentions and create/emit notifications for socket context
async function handleMentionsAndNotificationsSocket(
  io: Server,
  app: Express, // Add app parameter
  message: any, // Should be a Prisma.MessageGetPayload_decorated type after creation
  senderId: string,
  workspaceId?: string,
  channelId?: string
) {
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
      ...(workspaceId && { members: { some: { workspaceId } } }),
    },
    select: { id: true, username: true },
  })

  const mentionedUserIds = users.map(u => u.id)
  const userSocketsMap = app.get('userSockets') as Map<string, string> | undefined;


  if (mentionedUserIds.length > 0) {
    const notificationCreateData = mentionedUserIds
      .filter(id => id !== senderId)
      .map(userId => ({
        userId,
        type: 'mention' as const,
        messageId: message.id,
        channelId: channelId,
        senderId,
      }))

    if (notificationCreateData.length > 0) {
      for (const notifData of notificationCreateData) {
        // Check user's preference for this channel/workspace for mentions
        const preference = await db.userNotificationPreference.findUnique({
          where: {
            userId_workspaceId_channelId: {
              userId: notifData.userId,
              workspaceId: workspaceId!, // workspaceId from function params
              channelId: channelId!   // channelId from function params
            }
          }
        });
        // Default to "MENTIONS": if no pref, mentions notify unless channel is explicitly "NONE".
        // If channel is "MENTIONS", mentions notify. If "ALL", mentions notify.
        const setting = preference?.notificationSetting || "MENTIONS";

        if (setting !== "NONE") {
          const newNotification = await db.notification.create({
            data: notifData,
            include: { // Include details needed for the client notification
              sender: { select: { id: true, username: true, name: true, avatar: true } },
              message: { select: { id: true, content: true, channelId: true, workspaceId: true } },
              channel: { select: { id: true, name: true, workspaceId: true } },
            }
          });

          const recipientSocketId = userSocketsMap?.get(newNotification.userId);
          if (recipientSocketId) {
            io.to(recipientSocketId).emit('new_notification', newNotification);
          }
        }
      }
    }
  }
  return { mentionedUserIds }
}


export const socketHandler = (io: Server, app: Express) => { // Add app parameter
  const userSocketsMap = app.get('userSockets') as Map<string, string>;

  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const { token, user } = socket.handshake.auth
      
      if (!token || !user) {
        logger.warn('Socket auth failed: Missing token or user')
        return next(new Error('Authentication error: No token or user provided'))
      }

      // Handle both JWT tokens and mock tokens for development
      if ((token.startsWith('mock-') || token.length > 50) && user.email) {
        try {
          // Find or create user in database
          let dbUser = await db.user.findUnique({
            where: { email: user.email },
            select: {
              id: true,
              username: true,
              name: true,
              email: true
            }
          })

          if (!dbUser) {
            // Create user if doesn't exist (for development)
            logger.info(`Creating new user: ${user.email}`)
            dbUser = await db.user.create({
              data: {
                email: user.email,
                username: user.username || user.name || user.email.split('@')[0],
                name: user.name || user.username || user.email.split('@')[0],
                password: 'mock-password' // This would be properly hashed in production
              },
              select: {
                id: true,
                username: true,
                name: true,
                email: true
              }
            })
            logger.info(`User created successfully: ${dbUser.username}`)
          }

          socket.data.user = dbUser
          logger.info(`Socket authenticated for user: ${dbUser.username}`)
          next()
        } catch (dbError) {
          logger.error('Database error during socket auth:', dbError)
          return next(new Error('Database connection error'))
        }
      } else {
        logger.warn('Socket auth failed: Invalid token format', { token: token.substring(0, 10) })
        return next(new Error('Authentication error: Invalid token format'))
      }
    } catch (error) {
      logger.error('Socket authentication error:', error)
      next(new Error('Authentication error'))
    }
  })

  io.on('connection', (socket: Socket) => {
    logger.info(`User connected: ${socket.data.user.username} (${socket.id})`)

    // Add user to connected users
    const socketUser: SocketUser = {
      id: socket.data.user.id,
      username: socket.data.user.username,
      name: socket.data.user.name,
      workspaceId: '',
      socketId: socket.id,
      isOnline: true
    }

    connectedUsers.set(socket.id, socketUser)
    if (userSocketsMap) {
        userSocketsMap.set(socket.data.user.id, socket.id);
    }
    // Update lastSeenAt on connection
    db.user.update({
        where: { id: socket.data.user.id },
        data: { lastSeenAt: new Date() }
    }).catch(err => logger.error(`Failed to update lastSeenAt for user ${socket.data.user.id} on connect:`, err));


    // Join workspace room
    socket.on('join_workspace', async (workspaceId: string) => {
      try {
        const currentUser = socket.data.user;
        const membership = await db.member.findFirst({
          where: { workspaceId, userId: currentUser.id }
        });

        if (!membership) {
          socket.emit('error', { message: 'Not authorized to join this workspace' });
          return;
        }

        socket.join(`workspace:${workspaceId}`);
        
        const userRecord = await db.user.findUnique({ // Fetch user for custom status
            where: { id: currentUser.id },
            select: { customStatusText: true, customStatusEmoji: true }
        });

        const connectedUserData = connectedUsers.get(socket.id);
        if (connectedUserData) {
          connectedUserData.workspaceId = workspaceId;
          connectedUsers.set(socket.id, connectedUserData);
        }

        // Notify other users in workspace about user coming online
        socket.to(`workspace:${workspaceId}`).emit('user_online', {
          userId: currentUser.id,
          username: currentUser.username,
          name: currentUser.name,
          customStatusText: userRecord?.customStatusText,
          customStatusEmoji: userRecord?.customStatusEmoji,
        });

        // Send current presence state of the workspace to the joining user
        const workspaceUsersData: Array<{userId: string, username: string, name?: string | null, isOnline: boolean, customStatusText?: string | null, customStatusEmoji?: string | null, lastSeenAt?: string | null}> = [];
        const membersOfWorkspace = await db.member.findMany({
            where: { workspaceId },
            include: { user: { select: { id: true, username: true, name: true, customStatusText: true, customStatusEmoji: true, lastSeenAt: true }}}
        });

        for (const member of membersOfWorkspace) {
            if (member.userId !== currentUser.id) { // Don't send self-presence in initial dump
                const isOnline = !!userSocketsMap?.has(member.userId); // Check if user has an active socket
                workspaceUsersData.push({
                    userId: member.userId,
                    username: member.user.username,
                    name: member.user.name,
                    isOnline: isOnline,
                    customStatusText: member.user.customStatusText,
                    customStatusEmoji: member.user.customStatusEmoji,
                    lastSeenAt: isOnline ? null : member.user.lastSeenAt?.toISOString() ?? null // Only send lastSeenAt if offline
                });
            }
        }
        socket.emit('workspace_presence_state', { workspaceId, users: workspaceUsersData });

        logger.info(`User ${currentUser.username} joined workspace ${workspaceId}`);
      } catch (error) {
        logger.error('Join workspace error:', error);
        socket.emit('error', { message: 'Failed to join workspace' });
      }
    })

    // Join channel room
    socket.on('join_channel', async (channelId: string) => {
      try {
        // Verify user is member of channel
        const membership = await db.channelMember.findFirst({
          where: {
            channelId,
            userId: socket.data.user.id
          }
        })

        if (!membership) {
          socket.emit('error', { message: 'Not authorized to join this channel' })
          return
        }

        socket.join(`channel:${channelId}`)
        logger.info(`User ${socket.data.user.username} joined channel ${channelId}`)

        // Emit event to workspace
        const user = socket.data.user
        const channel = await db.channel.findUnique({ where: { id: channelId }, select: { name: true, workspaceId: true, isPrivate: true }})
        if (channel && channel.workspaceId) {
            io.to(`workspace:${channel.workspaceId}`).emit('user_joined_channel', {
                userId: user.id,
                username: user.username,
                name: user.name,
                channelId: channelId,
                channelName: channel.name,
                isPrivate: channel.isPrivate,
                workspaceId: channel.workspaceId
            })
        }

      } catch (error) {
        logger.error('Join channel error:', error)
        socket.emit('error', { message: 'Failed to join channel' })
      }
    })

    // Leave channel room
    socket.on('leave_channel', async (data: { channelId: string, workspaceId: string }) => {
      const { channelId, workspaceId } = data; // Client should send workspaceId for broadcast
      socket.leave(`channel:${channelId}`)
      logger.info(`User ${socket.data.user.username} left channel ${channelId}`)

      // Emit event to workspace
      if (workspaceId) {
        io.to(`workspace:${workspaceId}`).emit('user_left_channel', {
            userId: socket.data.user.id,
            username: socket.data.user.username,
            channelId: channelId,
            workspaceId: workspaceId
        })
      } else {
        // Fallback: try to get workspaceId from connectedUsers map if client doesn't send it
        // This is less reliable as user might not be in connectedUsers' workspace context correctly
        const user = connectedUsers.get(socket.id);
        if (user && user.workspaceId) {
             io.to(`workspace:${user.workspaceId}`).emit('user_left_channel', {
                userId: socket.data.user.id,
                username: socket.data.user.username,
                channelId: channelId,
                workspaceId: user.workspaceId
            })
        } else {
            logger.warn(`Could not determine workspaceId for user ${socket.data.user.username} leaving channel ${channelId} to broadcast user_left_channel.`);
        }
      }
    })

    // Handle new message
    socket.on('send_message', async (data: { channelId?: string; recipientId?: string; content: string; parentId?: string; attachmentIds?: string[] }) => { // Added attachmentIds
      try {
        const { channelId, recipientId, content, parentId, attachmentIds } = data; // Added attachmentIds
        const userId = socket.data.user.id;
        const senderUser = socket.data.user;

        if (!content && (!attachmentIds || attachmentIds.length === 0)) { // Message must have content or attachments
          socket.emit('error', { message: 'Message content or attachments are required' });
          return;
        }
        if (!channelId && !recipientId) {
            socket.emit('error', { message: 'Message target (channelId or recipientId) is required.' });
            return;
        }

        let finalMessage: any; // Will hold the message object after all DB operations
        let messageIdForRefetch: string | null = null; // To ensure we have the ID after transaction

        await db.$transaction(async (prisma) => {
          let createdMessageInTransaction: any;
          let determinedThreadId: string | null = null;
          const messageData: any = {
            content,
            userId,
            channelId: channelId || null,
            recipientId: recipientId || null,
            parentId: parentId || null,
            workspaceId: null, // Will be set if channelId is present
          };

          if (channelId) {
            const channel = await prisma.channel.findUnique({ where: { id: channelId } });
            if (!channel) throw new Error('Channel not found');
            const membership = await prisma.channelMember.findFirst({ where: { channelId, userId } });
            if (!membership) throw new Error('User not member of channel');
            messageData.workspaceId = channel.workspaceId;
          }

          if (parentId) {
            const parentMsg = await prisma.message.findUnique({ where: { id: parentId } });
            if (!parentMsg) throw new Error('Parent message not found');
            determinedThreadId = parentMsg.threadId || parentMsg.id;
            messageData.threadId = determinedThreadId;

            await prisma.message.update({
              where: { id: parentId },
              data: { replyCount: { increment: 1 }, lastReplyAt: new Date() },
            });
            if (!parentMsg.threadId) { // Ensure root parent has threadId set
                await prisma.message.update({ where: {id: parentMsg.id}, data: {threadId: parentMsg.id}});
            }
            if (determinedThreadId) { // Update root of thread
              await prisma.message.update({
                where: { id: determinedThreadId },
                data: { replyCount: { increment: 1 }, lastReplyAt: new Date() },
              });
            }
          }

          let createdMessage = await prisma.message.create({
            data: messageData,
            include: { user: { select: { id: true, username: true, name: true } } },
          });

          if (!parentId) {
            createdMessage = await prisma.message.update({
              where: { id: createdMessage.id },
              data: { threadId: createdMessage.id },
              include: { user: { select: { id: true, username: true, name: true } } },
            });
          }

          createdMessageInTransaction = createdMessage;

          // Handle mentions
          if (createdMessageInTransaction.channelId) {
            const { mentionedUserIds } = await handleMentionsAndNotificationsSocket(
              io, app, createdMessageInTransaction, userId, createdMessageInTransaction.workspaceId, createdMessageInTransaction.channelId
            );
            if (mentionedUserIds.length > 0) {
              createdMessageInTransaction = await prisma.message.update({
                where: { id: createdMessageInTransaction.id },
                data: { mentionedUserIds: mentionedUserIds.join(',') },
                include: { user: { select: { id: true, username: true, name: true } } },
              });
            }
          }

          // Link attachments
          if (attachmentIds && attachmentIds.length > 0) {
            const attachmentsToLink = await prisma.attachment.findMany({
              where: {
                id: { in: attachmentIds as string[] },
                uploaderId: userId,
                messageId: null,
                ...(messageData.workspaceId && { workspaceId: messageData.workspaceId }),
              }
            });
            if (attachmentsToLink.length !== attachmentIds.length) {
              throw new Error('Invalid or already linked attachments provided for socket message.');
            }
            await prisma.attachment.updateMany({
              where: { id: { in: attachmentsToLink.map(att => att.id) } },
              data: { messageId: createdMessageInTransaction.id }
            });
          }

          // DM notifications (using createdMessageInTransaction)
          if (createdMessageInTransaction.recipientId && userId !== createdMessageInTransaction.recipientId) {
            let recipientWorkspaceIdForDmPref = messageData.workspaceId; // Workspace context of the DM
            if (!recipientWorkspaceIdForDmPref) {
                // Fallback: find any workspace the recipient is in to check their DM preference for *a* workspace.
                // This is still a simplification. Ideally, DMs have a clearer workspace context for prefs, or prefs are global.
                const recipientMemberRecord = await prisma.member.findFirst({ where: {userId: createdMessageInTransaction.recipientId }});
                if (recipientMemberRecord) recipientWorkspaceIdForDmPref = recipientMemberRecord.workspaceId;
            }

            let dmSetting = "ALL"; // Default to notify
            if (recipientWorkspaceIdForDmPref) { // Only check if we have a workspace context for the preference
                const dmPreference = await prisma.userNotificationPreference.findUnique({
                  where: { userId_workspaceId_channelId: {
                      userId: createdMessageInTransaction.recipientId,
                      workspaceId: recipientWorkspaceIdForDmPref,
                      channelId: null // DM preference
                  }}
                });
                dmSetting = dmPreference?.notificationSetting || "ALL";
            }

            if (dmSetting !== "NONE") {
              const notification = await prisma.notification.create({
                data: {
                  userId: createdMessageInTransaction.recipientId, type: 'new_dm', messageId: createdMessageInTransaction.id, senderId: userId,
                },
                include: {
                  sender: { select: { id: true, username: true, name: true, avatar: true } },
                  message: { select: { id: true, content: true, channelId: true, recipientId: true, workspaceId: true } },
                },
              });
              const recipientSocketId = userSocketsMap?.get(createdMessageInTransaction.recipientId);
              if (recipientSocketId) {
                io.to(recipientSocketId).emit('new_notification', notification);
              }
            }
          }
          messageIdForRefetch = createdMessageInTransaction.id; // Set ID for refetch
        }); // End transaction

        if (!messageIdForRefetch) {
          throw new Error("Socket message creation failed within transaction.");
        }

        // Refetch the message with full details for broadcasting
        finalMessage = await db.message.findUnique({ // Use finalMessage here
            where: { id: messageIdForRefetch },
            include: {
                user: { select: { id: true, username: true, name: true, avatar: true } },
                parentMessage: { select: { id: true, userId: true, content: true, user: {select: {id: true, username: true, name: true}}}},
                attachments: { orderBy: { createdAt: 'asc' }} // Include attachments
            }
        });


        if (finalMessage.channelId) {
          io.to(`channel:${finalMessage.channelId}`).emit('new_message', finalMessage);
        } else if (finalMessage.recipientId) {
          const messageDataForDM: MessageData = {
            id: finalMessage.id,
            content: finalMessage.content,
            userId: finalMessage.userId,
            recipientId: finalMessage.recipientId,
            createdAt: finalMessage.createdAt.toISOString(),
            user: finalMessage.user,
            parentId: finalMessage.parentId,
            threadId: finalMessage.threadId,
            replyCount: finalMessage.replyCount,
            lastReplyAt: finalMessage.lastReplyAt?.toISOString(), // Add lastReplyAt
          };
          socket.emit('new_direct_message', messageDataForDM); // To sender
          const recipientSocketId = userSocketsMap?.get(finalMessage.recipientId);
          if (recipientSocketId) {
            io.to(recipientSocketId).emit('new_direct_message', messageDataForDM); // To recipient
          }
        }

        // Emit thread_updated event if it was a reply
        if (finalMessage.parentId && finalMessage.threadId) {
            const rootMessageOfThread = await db.message.findUnique({
                where: { id: finalMessage.threadId },
                select: { replyCount: true, lastReplyAt: true, channelId: true, recipientId: true, userId: true }
            });

            if (rootMessageOfThread) {
                const threadUpdatePayload = {
                    rootMessageId: finalMessage.threadId,
                    replyCount: rootMessageOfThread.replyCount,
                    lastReplyAt: rootMessageOfThread.lastReplyAt?.toISOString(),
                    latestReply: finalMessage // Send the full new message as the latest reply
                };

                if (rootMessageOfThread.channelId) {
                    io.to(`channel:${rootMessageOfThread.channelId}`).emit('thread_updated', threadUpdatePayload);
                } else if (rootMessageOfThread.recipientId) {
                    // Emit to both participants of the DM thread
                    const user1Socket = userSocketsMap?.get(rootMessageOfThread.userId);
                    const user2Socket = userSocketsMap?.get(rootMessageOfThread.recipientId);
                    if (user1Socket) io.to(user1Socket).emit('thread_updated', threadUpdatePayload);
                    if (user2Socket && user1Socket !== user2Socket) io.to(user2Socket).emit('thread_updated', threadUpdatePayload);
                }
            }
        }

        logger.info(`Message sent by ${senderUser.username} to ${channelId ? `channel ${channelId}` : `user ${recipientId}`}${parentId ? ` as reply to ${parentId}` : ''}`);
      } catch (error) {
        logger.error('Send message error (socket):', error)
        socket.emit('error', { message: 'Failed to send message: ' + (error as Error).message })
      }
    })

    // Handle typing indicators for Channels
    socket.on('start_typing', async (data: { channelId: string }) => {
      try {
        const { channelId } = data
        const currentUser = socket.data.user;
        
        // Verify user is member of channel
        const membership = await db.channelMember.findFirst({
          where: {
            channelId,
            userId: socket.data.user.id
          }
        })

        if (!membership) {
          return
        }

        const typingData: TypingData = {
          userId: socket.data.user.id,
          username: socket.data.user.username,
          channelId
        }

        socket.to(`channel:${channelId}`).emit('user_typing', typingData)
      } catch (error) {
        logger.error('Start typing error:', error)
      }
    })

    socket.on('stop_typing', async (data: { channelId: string }) => {
      try {
        const { channelId } = data
        const currentUser = socket.data.user;
        
        // Verify user is member of channel
        const membership = await db.channelMember.findFirst({
          where: {
            channelId,
            userId: currentUser.id
          }
        })

        if (!membership) {
          return
        }

        socket.to(`channel:${channelId}`).emit('user_stop_typing', {
          userId: currentUser.id,
          channelId
        })
      } catch (error) {
        logger.error('Stop typing error:', error)
      }
    })

    // Handle DM Typing Indicators
    socket.on('dm_start_typing', (data: { recipientId: string }) => {
      const { recipientId } = data;
      const sender = socket.data.user;
      const recipientSocketId = userSocketsMap?.get(recipientId);

      if (recipientSocketId) {
        io.to(recipientSocketId).emit('dm_user_typing', {
          senderId: sender.id,
          senderUsername: sender.username,
        });
      }
    });

    socket.on('dm_stop_typing', (data: { recipientId: string }) => {
      const { recipientId } = data;
      const sender = socket.data.user;
      const recipientSocketId = userSocketsMap?.get(recipientId);

      if (recipientSocketId) {
        io.to(recipientSocketId).emit('dm_user_stop_typing', {
          senderId: sender.id,
        });
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => { // Made async
      const disconnectedUser = socket.data.user;
      if (!disconnectedUser) return;

      logger.info(`User disconnected: ${disconnectedUser.username} (${socket.id})`)

      // Update lastSeenAt on disconnect
      try {
        await db.user.update({
          where: { id: disconnectedUser.id },
          data: { lastSeenAt: new Date() }
        });
      } catch (err) {
        logger.error(`Failed to update lastSeenAt for user ${disconnectedUser.id} on disconnect:`, err);
      }

      const connectedUserData = connectedUsers.get(socket.id);
      if (connectedUserData && connectedUserData.workspaceId) {
        // Notify other users in workspace about user going offline
        // Include custom status if available, as user_online does.
        // However, custom status might not be relevant for "offline" as much,
        // but sending it makes user_online/user_offline payloads more consistent.
        // For offline, custom status might be implicitly cleared or ignored by client.
        socket.to(`workspace:${connectedUserData.workspaceId}`).emit('user_offline', {
          userId: disconnectedUser.id,
          username: disconnectedUser.username,
          name: disconnectedUser.name, // Assuming name is on disconnectedUser (socket.data.user)
          // customStatusText: userRecord?.customStatusText, // Need to fetch or have it on socket.data.user
          // customStatusEmoji: userRecord?.customStatusEmoji,
        });
      }

      // Remove user from connected users
      connectedUsers.delete(socket.id);
      if (userSocketsMap) {
        userSocketsMap.delete(disconnectedUser.id);
      }
    })

    // Handle errors
    socket.on('error', (error) => {
      logger.error('Socket error:', error)
    })
  })

  // Utility functions for external use
  // These may need `app` if they are to be called from outside, or be refactored
  // For now, assuming they are called from contexts where `app` or `userSocketsMap` is available
  // Or, they are fine if `userSocketsMap` is kept up-to-date by the main handler instance.
  return {
    getConnectedUsers: () => Array.from(connectedUsers.values()),
    // getUserSocket: (userId: string) => userSocketsMap?.get(userId), // This would need app if called externally
    // emitToUser: (userId: string, event: string, data: any) => { // This would need app
    //   const socketId = userSocketsMap?.get(userId)
    //   if (socketId) {
    //     io.to(socketId).emit(event, data)
    //   }
    // },
    // The following are fine as they use io directly for room emissions
    emitToWorkspace: (workspaceId: string, event: string, data: any) => {
      io.to(`workspace:${workspaceId}`).emit(event, data)
    },
    emitToChannel: (channelId: string, event: string, data: any) => {
      io.to(`channel:${channelId}`).emit(event, data)
    }
  }
}