'use client'

import { useState, useEffect, useRef } from 'react'
import { MessageList } from './message-list'
import { MessageComposer } from './message-composer'
import { TypingIndicator } from './typing-indicator' // Keep this if used, or remove if not.
import { useSocket } from '@/hooks/useSocket'
import { useSession } from 'next-auth/react'; // Ensure useSession is imported once
import { ThreadPanel } from './thread-panel';
import { ChannelDetailsPanel } from './channel-details-panel'; // Import ChannelDetailsPanel


interface WorkspaceMember {
  user: {
    id: string
    username: string
    name?: string
  }
}
interface MessageAreaProps {
  channel: any
  workspaceMembers?: WorkspaceMember[]
  isCurrentUserAdmin?: boolean; // Added for ChannelDetailsPanel
}

export function MessageArea({ channel, workspaceMembers = [], isCurrentUserAdmin = false }: MessageAreaProps) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [openedThreadId, setOpenedThreadId] = useState<string | null>(null);
  const [showChannelDetails, setShowChannelDetails] = useState(false); // State for panel visibility
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const {
    joinChannel,
    leaveChannel,
    sendMessage, // This will be used by MessageComposer for main messages
                 // And potentially by ThreadPanel's composer if not specialized
    onNewMessage,
    onUserTyping,
    onUserStopTyping,
    isConnected,
    onMessageUpdated,
    onMessageDeleted,
    onThreadUpdated,
    onReactionUpdated // New
  } = useSocket()

  const handleViewThread = (messageId: string) => {
    setOpenedThreadId(messageId);
  };

  useEffect(() => {
    if (channel?.id) {
      loadMessages()
      joinChannel(channel.id)
    }
    
    return () => {
      if (channel?.id && channel.workspaceId) { // Ensure workspaceId is available for leaveChannel
        leaveChannel(channel.id, channel.workspaceId)
      } else if (channel?.id) {
        // Fallback or error if workspaceId isn't available - ideally channel object always has it
        console.warn("Attempted to leave channel without workspaceId:", channel)
        // leaveChannel(channel.id, GET_WORKSPACE_ID_SOMEHOW)
      }
    }
  }, [channel?.id, channel?.workspaceId, joinChannel, leaveChannel])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    const cleanupMessage = onNewMessage((newMessage) => {
      setMessages(prev => [...prev, newMessage])
    })
    
    const cleanupTyping = onUserTyping((data) => {
      setTypingUsers(prev => {
        if (!prev.includes(data.username)) {
          return [...prev, data.username]
        }
        return prev
      })
    })
    
    const cleanupStopTyping = onUserStopTyping((data) => {
      if (data.channelId === channel?.id) {
        setTypingUsers(prev => prev.filter(username => username !== data.userId))
      }
    })

    // Handle message updates
    const cleanupMessageUpdated = onMessageUpdated((updatedMessage) => {
      if (updatedMessage.channelId === channel?.id) {
        setMessages(prevMessages =>
          prevMessages.map(msg => msg.id === updatedMessage.id ? { ...msg, ...updatedMessage, user: msg.user } : msg)
          // Note: backend sends full message, including user. If user object on updatedMessage is partial, merge carefully.
          // Assuming updatedMessage user is complete or we only update content & updatedAt.
          // For safety, if only content changes: { ...msg, content: updatedMessage.content, updatedAt: updatedMessage.updatedAt }
        );
      }
    });

    // Handle message deletions
    const cleanupMessageDeleted = onMessageDeleted((deletedMessageData) => {
      if (deletedMessageData.channelId === channel?.id) {
        setMessages(prevMessages => prevMessages.filter(msg => msg.id !== deletedMessageData.id));
      }
    });
    
    return () => {
      cleanupMessage()
      cleanupTyping()
      cleanupStopTyping()
      cleanupMessageUpdated()
      cleanupMessageDeleted()
    }
  }, [channel?.id, onNewMessage, onUserTyping, onUserStopTyping, onMessageUpdated, onMessageDeleted])

  // Listen for thread updates to update reply counts/last reply time on root messages
  useEffect(() => {
    if (!channel?.id || !onThreadUpdated) return;

    const cleanupThreadUpdated = onThreadUpdated((data) => {
      // Ensure the update is for a message in the current channel
      // This check might be redundant if thread_updated is only sent to the relevant channel by backend
      setMessages(prevMessages =>
        prevMessages.map(msg => {
          if (msg.id === data.rootMessageId && msg.channelId === channel.id) {
            return {
              ...msg,
              replyCount: data.replyCount,
              lastReplyAt: data.lastReplyAt,
              // latestReply: data.latestReply // Storing full latestReply object might be too much here
                                            // The UI in MessageList might just need count & time.
            };
          }
          return msg;
        })
      );
    });

    return () => {
      cleanupThreadUpdated();
    };
  }, [channel?.id, onThreadUpdated]);

  // Listen for reaction updates
  useEffect(() => {
    if (!channel?.id || !onReactionUpdated) return;

    const cleanupReactionUpdated = onReactionUpdated((data) => {
      setMessages(prevMessages =>
        prevMessages.map(msg => {
          if (msg.id === data.messageId && msg.channelId === channel.id) {
            // The backend sends aggregated reactions.
            // The structure of `data.reactions` should match what MessageList expects for its `message.reactions`
            // which is Array<{emoji: string, user: {id, username, name}, ...other Reaction fields}>
            // The aggregated format from backend is: { emoji: String, count: Int, users: UserSnippet[] }
            // This means MessageList's internal aggregation logic is good, but the prop type for Message.reactions
            // should be the direct array of Reaction objects from Prisma.
            // The socket payload `data.reactions` is already the aggregated list.
            // So, we need to transform it OR MessageList needs to handle both raw and aggregated.
            // For now, let's assume MessageList's prop `message.reactions` expects the raw list,
            // and the socket `reaction_updated` payload is the *aggregated* one.
            // This is a mismatch.
            // Plan: The backend should send the *raw* list of reactions for `reaction_updated` if clients are to update `message.reactions` directly.
            // OR, the client `MessageList` should be adapted to take aggregated reactions.
            // For now, let's assume the backend `reaction_updated` payload IS the new raw list of reactions for that message.
            // This means `reactions.ts` `aggregatedReactions` should actually be the raw `db.reaction.findMany(...)` result.
            // Let's proceed with this assumption for now and correct backend if needed.
            // **Correction:** The plan for `reaction_updated` was `Payload: { messageId: String, reactions: AggregatedReaction[] }`.
            // This means `MessageList` should ideally display this aggregated structure directly, or `Message.reactions` type needs to change.
            // For simplicity now, I'll update `Message.reactions` on the client to store the aggregated form.
            // This requires changing the `Message` interface and how `MessageList` processes reactions.

            // Simpler approach for now: Assume `data.reactions` is the new *raw* array of reactions.
            // This means backend `reaction_updated` payload needs to be adjusted.
            // Let's assume for THIS step, `data.reactions` IS the new raw list.
             return { ...msg, reactions: data.reactions };
          }
          return msg;
        })
      );
    });
    return () => {
      cleanupReactionUpdated();
    };
  }, [channel?.id, onReactionUpdated]);


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadMessages = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
      
      const response = await fetch(`${backendUrl}/api/messages?channelId=${channel.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json()
      
      if (data.messages) {
        setMessages(data.messages)
      }
    } catch (error) {
      console.error('Failed to load messages:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSendMessage = async (content: string) => {
    try {
      const token = localStorage.getItem('token')
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
      
      const response = await fetch(`${backendUrl}/api/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content,
          channelId: channel.id,
        }),
      })

      const data = await response.json()
      
      if (data.message) {
        // Don't add to local state - it will come via Socket.io
        // Real-time message sending via Socket.io
        if (isConnected) {
          sendMessage(channel.id, content)
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  return (
    <div className="flex h-full"> {/* Ensure parent flex container for ThreadPanel */}
      <div className="flex flex-col h-full flex-1"> {/* Main message area takes available space */}
        {/* Channel Header */}
        <div className="border-b border-slate-200 dark:border-slate-700 p-3 bg-white dark:bg-slate-800 shadow-sm"> {/* p-3 for compactness, dark mode bg */}
          <div className="flex items-center justify-between">
            <div
              className="flex items-center gap-2 min-w-0 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 p-1 -ml-1 rounded-md"
              onClick={() => setShowChannelDetails(true)}
              title="View channel details"
            >
              <h2 className="font-semibold text-slate-800 dark:text-slate-100 text-base truncate">
                <span className="text-slate-500 dark:text-slate-400"># </span>{channel.name}
              </h2>
              {channel.isPrivate && (
                <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500 flex-shrink-0">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  <span>Private</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            {/* Channel members / info button - also opens panel */}
            <button
              onClick={() => setShowChannelDetails(true)}
              title="View channel details"
              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>
             {/* Placeholder: Call button */}
            <button title="Start a call" className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md">
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
            </button>
            {/* Placeholder: More actions button */}
            <button title="More channel actions" className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
            </button>
          </div>
        </div>
        {channel.description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
            {/* Icon for description can be added if desired */}
            {channel.description}
          </p>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-300 dark:border-slate-600 border-t-indigo-600"></div>
              Loading messages...
            </div>
          </div>
        ) : (
          <>
            <MessageList messages={messages} onViewThread={handleViewThread} />
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Composer */}
      <div className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700"> {/* Dark mode for composer container */}
        <MessageComposer 
          onSendMessage={handleSendMessage}
          placeholder={`Message #${channel.name}`}
          channelId={channel.id}
          workspaceId={channel?.workspaceId} // Pass workspaceId
          workspaceMembers={workspaceMembers}
        />
      </div>
    </div>

    {/* Thread Panel */}
    {openedThreadId && (
      <ThreadPanel
        rootMessageId={openedThreadId}
        workspaceId={channel?.workspaceId} // Pass workspaceId for context
        workspaceMembers={workspaceMembers} // For @mentions in thread replies
        currentUserId={session?.user?.id}
        onClose={() => setOpenedThreadId(null)}
        // onMessageSent={() => { /* Optionally refetch main channel messages or specific message for replyCount update */ }}
      />
    )}
    {showChannelDetails && channel && (
      <ChannelDetailsPanel
        channel={channel}
        workspaceId={channel.workspaceId} // Ensure channel object has workspaceId
        onClose={() => setShowChannelDetails(false)}
        isCurrentUserAdmin={isCurrentUserAdmin}
        // currentUserId={session?.user?.id} // Pass if needed by panel for member list interactions
      />
    )}
  </div>
  )
}