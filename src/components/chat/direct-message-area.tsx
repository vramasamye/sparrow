'use client'

import { useState, useEffect, useRef } from 'react'
import { getAvatarUrl, getInitials } from '@/utils/displayUtils';
import { useSession } from 'next-auth/react'
import { MessageList } from './message-list'
import { MessageComposer } from './message-composer'
import { useSocket } from '@/hooks/useSocket'
import { usePresence } from '@/contexts/PresenceContext'; // Import usePresence

interface DirectMessageAreaProps {
  otherUser: {
    id: string
    username: string
    name?: string
    avatar?: string
  }
  workspaceId?: string; // Added workspaceId
  workspaceMembers?: any[]
  onClose: () => void
}

export function DirectMessageArea({ otherUser, workspaceId, workspaceMembers = [], onClose }: DirectMessageAreaProps) {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { presences } = usePresence();
  const otherUserPresence = presences.get(otherUser.id);
  // const [dmChannel, setDmChannel] = useState<any>(null) // Removed: DMs are not channels
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const {
    sendDirectMessage,
    onNewDirectMessage,
    isConnected,
    onMessageUpdated, // For message edits
    onMessageDeleted,  // For message deletes
    startDmTyping,    // DM Typing
    stopDmTyping,     // DM Typing
    onDmUserTyping,   // DM Typing
    onDmUserStopTyping,// DM Typing
    onThreadUpdated,   // New for threads
    onReactionUpdated // New for reactions
  } = useSocket()

  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [openedThreadId, setOpenedThreadId] = useState<string | null>(null); // State for open thread

  const handleViewThread = (messageId: string) => {
    setOpenedThreadId(messageId);
  };

  useEffect(() => {
    loadDirectMessages()
  }, [otherUser.id])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Removed useEffect for joining dmChannel

  useEffect(() => {
    const cleanup = onNewDirectMessage((newMessage) => {
      // Ensure this message is part of the current DM conversation
      if (newMessage.userId === otherUser.id || newMessage.recipientId === otherUser.id) {
         setMessages(prev => [...prev, newMessage])
      }
    });

    // Handle message updates for DMs
    const cleanupMessageUpdated = onMessageUpdated((updatedMessage) => {
      // Check if the updated message belongs to this DM conversation
      const isToCurrentUser = updatedMessage.recipientId === session?.user?.id && updatedMessage.userId === otherUser.id;
      const isFromCurrentUser = updatedMessage.userId === session?.user?.id && updatedMessage.recipientId === otherUser.id;

      if (isToCurrentUser || isFromCurrentUser) {
        setMessages(prevMessages =>
          prevMessages.map(msg => msg.id === updatedMessage.id ? { ...msg, ...updatedMessage, user: msg.user } : msg)
        );
      }
    });

    // Handle message deletions for DMs
    const cleanupMessageDeleted = onMessageDeleted((deletedMessageData) => {
       // Check if the deleted message belongs to this DM conversation
      const isRelevantDM =
        (deletedMessageData.userId === session?.user?.id && deletedMessageData.recipientId === otherUser.id) ||
        (deletedMessageData.recipientId === session?.user?.id && deletedMessageData.userId === otherUser.id);

      if (isRelevantDM) {
        setMessages(prevMessages => prevMessages.filter(msg => msg.id !== deletedMessageData.id));
      }
    });

    return () => {
      cleanup();
      cleanupMessageUpdated();
      cleanupMessageDeleted();
    }
  }, [onNewDirectMessage, onMessageUpdated, onMessageDeleted, otherUser.id, session?.user?.id])

  // Listen for thread updates to update reply counts/last reply time on root messages in DMs
  useEffect(() => {
    if (!otherUser?.id || !onThreadUpdated || !session?.user?.id) return;

    const cleanupThreadUpdated = onThreadUpdated((data) => {
      // Check if the thread update is relevant to the current DM
      setMessages(prevMessages =>
        prevMessages.map(msg => {
          // A message is relevant if its ID is the rootMessageId, and it's part of this DM
          const isToCurrentUser = msg.recipientId === session.user.id && msg.userId === otherUser.id;
          const isFromCurrentUser = msg.userId === session.user.id && msg.recipientId === otherUser.id;

          if (msg.id === data.rootMessageId && (isToCurrentUser || isFromCurrentUser)) {
            return {
              ...msg,
              replyCount: data.replyCount,
              lastReplyAt: data.lastReplyAt,
            };
          }
          return msg;
        })
      );
    });
    return () => {
      cleanupThreadUpdated();
    };
  }, [otherUser?.id, session?.user?.id, onThreadUpdated]);

  // Listen for reaction updates for DMs
  useEffect(() => {
    if (!otherUser?.id || !onReactionUpdated || !session?.user?.id) return;

    const cleanupReactionUpdated = onReactionUpdated((data) => {
       // Check if the reaction update is relevant to the current DM
      setMessages(prevMessages =>
        prevMessages.map(msg => {
          const isToCurrentUser = msg.recipientId === session.user.id && msg.userId === otherUser.id;
          const isFromCurrentUser = msg.userId === session.user.id && msg.recipientId === otherUser.id;

          if (msg.id === data.messageId && (isToCurrentUser || isFromCurrentUser)) {
            return { ...msg, reactions: data.reactions }; // Assuming data.reactions is the raw list
          }
          return msg;
        })
      );
    });
    return () => {
      cleanupReactionUpdated();
    };
  }, [otherUser?.id, session?.user?.id, onReactionUpdated]);


  // DM Typing Indicator Effects
  useEffect(() => {
    if (!otherUser?.id || !session?.user?.id) return;

    const typingCleanup = onDmUserTyping((data) => {
      if (data.senderId === otherUser.id) {
        setIsOtherUserTyping(true);
      }
    });

    const stopTypingCleanup = onDmUserStopTyping((data) => {
      if (data.senderId === otherUser.id) {
        setIsOtherUserTyping(false);
      }
    });

    return () => {
      typingCleanup();
      stopTypingCleanup();
    };
  }, [onDmUserTyping, onDmUserStopTyping, otherUser?.id, session?.user?.id]);


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadDirectMessages = async () => {
    setLoading(true)
    try {
      // Corrected API endpoint for fetching messages
      const token = localStorage.getItem('token'); // Assuming token is stored this way
      const response = await fetch(`/api/messages?recipientId=${otherUser.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json()
      
      // DMs don't have a "channel" object in the same way channels do.
      // The concept of dmChannel and joining a channel for DMs will be removed.
      if (data.messages) {
        // setDmChannel(null); // No separate DM channel object needed
        setMessages(data.messages)
      } else if (response.status === 403) {
        console.error("Unauthorized to fetch direct messages or no conversation yet.");
        setMessages([]); // Set to empty if not authorized or no convo
      } else {
        console.error("Failed to parse messages or unexpected response structure:", data);
        setMessages([]);
      }
    } catch (error) {
      console.error('Failed to load direct messages:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSendMessage = async (content: string) => {
    if (!session?.user?.id) {
      console.error("User not authenticated to send message");
      return;
    }
    try {
      // Corrected API endpoint for sending messages
      const token = localStorage.getItem('token');
      const response = await fetch('/api/messages', { // Corrected endpoint
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content,
          recipientId: otherUser.id,
        }),
      })

      const data = await response.json()
      
      if (data.message) {
        // Optimistic update is tricky if we rely on socket for "self" message too.
        // Backend `new_direct_message` sends to both sender and recipient.
        // So, we can choose to rely on socket for adding the message to avoid duplication.
        // For now, let's remove optimistic add from API response if socket is connected.
        // If not connected, this optimistic add is useful.
        if (!isConnected) {
            setMessages(prev => [...prev, data.message]);
        }
        
        // Send real-time message if connected
        if (isConnected) {
          sendDirectMessage(otherUser.id, content); // Corrected: pass content string
        }
      } else {
        console.error("Failed to send message, API response error:", data.error || response.statusText);
      }
    } catch (error) {
      console.error('Failed to send direct message:', error);
    }
  }

  return (
    <div className="flex h-full"> {/* Ensure parent flex container */}
      <div className="flex flex-col h-full flex-1"> {/* Main DM area */}
        {/* DM Header */}
        {/* p-3 for compactness, dark mode styles, consistent with MessageArea header */}
        <div className="border-b border-slate-200 dark:border-slate-700 p-3 bg-white dark:bg-slate-800 shadow-sm">
        <div className="flex items-center justify-between">
{/* No duplicate import needed here */}
// ... (other imports and interfaces)

// Inside DirectMessageArea component, in the header part:
          <div className="flex items-center gap-2.5 min-w-0"> {/* gap-2.5 */}
            {/* Back button for mobile/responsive (optional, can be handled by parent layout) */}
            {/* <button
              onClick={onClose}
              className="p-1 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md lg:hidden"
              title="Back"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button> */}
            <div className="relative flex-shrink-0">
              {otherUser.avatar ? (
                  <img
                    src={getAvatarUrl(otherUser.avatar)}
                    alt={otherUser.name || otherUser.username}
                    className="w-7 h-7 rounded-full object-cover"
                    onError={(e) => e.currentTarget.src = getAvatarUrl(null)}
                  />
                ) : (
                  <div className="w-7 h-7 bg-slate-600 dark:bg-slate-700 rounded-full flex items-center justify-center">
                    <span className="text-white text-[10px] font-semibold">
                      {getInitials(otherUser.name, otherUser.username)}
                    </span>
                  </div>
                )}
                <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 border border-white dark:border-slate-800 rounded-full ${otherUserPresence?.isOnline ? 'bg-green-400' : 'bg-slate-500'}`}></div>
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate flex items-center">
                  <span>{otherUser.name || otherUser.username}</span>
                  {otherUserPresence?.customStatusEmoji && (
                    <span className="ml-1.5 text-xs" title={otherUserPresence?.customStatusText || ''}>{otherUserPresence.customStatusEmoji}</span>
                  )}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate" title={otherUserPresence?.customStatusText || ''}>
                  {otherUserPresence?.isOnline
                    ? (otherUserPresence.customStatusText || 'Online')
                    : (otherUserPresence?.lastSeenAt ? `Last seen ${new Date(otherUserPresence.lastSeenAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : 'Offline')}
                </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1"> {/* Reduced gap */}
             {/* Placeholder: Call button */}
             <button title="Start a call" className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
            </button>
            {/* Placeholder: More Info/Actions Button */}
            <button title="View user info" className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>
            {/* Close button - useful on larger screens too if DM area is not full height / part of a multi-column layout */}
            {/* <button
              onClick={onClose}
              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md"
              title="Close DM"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button> */}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center gap-3 text-slate-500">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-300 border-t-indigo-600"></div>
              Loading conversation...
            </div>
          </div>
        ) : (
          <>
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full text-slate-500">
                <div className="text-center">
                  <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="text-lg font-medium text-slate-700">Start a conversation</p>
                  <p className="text-sm text-slate-500">
                    This is the beginning of your direct message history with {otherUser.name || otherUser.username}.
                  </p>
                </div>
              </div>
            )}
            <MessageList messages={messages} onViewThread={handleViewThread} />
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Typing Indicator */}
      {isOtherUserTyping && (
        <div className="px-4 pt-1 pb-2 text-xs text-slate-500 dark:text-slate-400 italic">
          {otherUser.name || otherUser.username} is typing...
        </div>
      )}

      {/* Message Composer */}
      <div className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
        <MessageComposer 
          onSendMessage={handleSendMessage} // This sends a main DM message
          placeholder={`Message ${otherUser.name || otherUser.username}`}
          onStartTyping={() => startDmTyping(otherUser.id)}
          onStopTyping={() => stopDmTyping(otherUser.id)}
          workspaceId={workspaceId} // Pass workspaceId
          workspaceMembers={workspaceMembers}
        />
      </div>
    </div>

    {/* Thread Panel for DMs */}
    {openedThreadId && (
      <ThreadPanel
        rootMessageId={openedThreadId}
        // workspaceId might not be directly applicable/available on `otherUser` easily here unless passed.
        // For DMs, @mentions in threads might be simpler (no workspace context needed for suggestions if not implemented)
        // or require workspaceMembers to be passed if suggestions are desired.
        workspaceMembers={workspaceMembers}
        currentUserId={session?.user?.id}
        onClose={() => setOpenedThreadId(null)}
      />
    )}
  </div> // This closes the main div className="flex h-full"
  )
}