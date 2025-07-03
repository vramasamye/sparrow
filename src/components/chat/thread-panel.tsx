'use client'

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { MessageList } from './message-list';
import { MessageComposer } from './message-composer';
import { useSocket } from '@/hooks/useSocket'; // For sending replies & real-time updates

// Assuming Message interface is similar to the one in MessageList
// Ideally, this would be a shared type
import { getAvatarUrl, getInitials } from '@/utils/displayUtils'; // Import helpers

interface User {
  id: string;
  username: string;
  name?: string;
  avatar?: string;
}
interface Message {
  id: string;
  content: string;
  createdAt: string;
  user: User;
  parentId?: string | null;
  threadId?: string | null;
  replyCount?: number;
  lastReplyAt?: string | null;
  // Add other message fields if necessary
}

interface ThreadPanelProps {
  rootMessageId: string;
  workspaceId?: string; // Needed for @mention suggestions in composer
  workspaceMembers?: any[]; // For @mention suggestions
  currentUserId?: string; // To distinguish user's own messages if needed for styling
  onClose: () => void;
  // onMessageSent?: () => void; // Optional: callback after a message is sent to refresh main list
}

export function ThreadPanel({
  rootMessageId,
  workspaceId,
  workspaceMembers = [],
  currentUserId,
  onClose,
}: ThreadPanelProps) {
  const { data: session } = useSession();
  const [rootMessage, setRootMessage] = useState<Message | null>(null);
  const [replies, setReplies] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { sendMessage, sendDirectMessage, onNewMessage, onNewDirectMessage } = useSocket(); // Assuming generic sendMessage can handle thread replies

  const fetchThread = useCallback(async () => {
    if (!rootMessageId) return;
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token') || session?.accessToken;
      const response = await fetch(`/api/messages/thread/${rootMessageId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Failed to fetch thread: ${response.statusText}`);
      }
      const data = await response.json();
      setRootMessage(data.rootMessage);
      setReplies(data.replies || []);
    } catch (err: any) {
      console.error("Error fetching thread:", err);
      setError(err.message || 'Could not load thread.');
    } finally {
      setIsLoading(false);
    }
  }, [rootMessageId, session?.accessToken]);

  useEffect(() => {
    fetchThread();
  }, [fetchThread]);

  // Listener for new messages to update replies in real-time
  useEffect(() => {
    const handleNewThreadMessage = (newMessage: Message) => {
      if (newMessage.threadId === rootMessageId && newMessage.id !== rootMessageId) {
        // Check if message is already in replies to prevent duplicates from optimistic updates + socket
        setReplies(prevReplies => {
            if (prevReplies.find(r => r.id === newMessage.id)) {
                return prevReplies;
            }
            return [...prevReplies, newMessage].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        });
      }
    };

    const newChannelMsgCleanup = onNewMessage(handleNewThreadMessage);
    const newDirectMsgCleanup = onNewDirectMessage(handleNewThreadMessage); // Assuming DMs can also be threaded

    return () => {
      newChannelMsgCleanup();
      newDirectMsgCleanup();
    };
  }, [rootMessageId, onNewMessage, onNewDirectMessage]);


  const handleSendReply = async (content: string) => {
    if (!rootMessage || !session?.user?.id) return;

    // Determine if the root message is in a channel or DM to use the correct send function
    // The backend will handle actual saving with parentId and threadId
    const payload = {
      content,
      parentId: rootMessage.id, // Reply is to the root message of this panel
      threadId: rootMessage.threadId || rootMessage.id, // Ensure threadId is passed
      // channelId or recipientId based on rootMessage context
      ...(rootMessage.channelId && { channelId: rootMessage.channelId }),
      ...(rootMessage.recipientId && { recipientId: rootMessage.userId === session.user.id ? rootMessage.recipientId : rootMessage.userId })
      // Note: For DMs, recipientId should be the *other* user.
      // If rootMessage.userId is current user, recipient is rootMessage.recipientId
      // If rootMessage.recipientId is current user, recipient is rootMessage.userId
    };

    // Optimistic update (optional, can rely purely on socket)
    // const optimisticReply: Message = { ... }
    // setReplies(prev => [...prev, optimisticReply]);


    // Use socket to send the message. Backend handles DB and broadcasts.
    if (payload.channelId) {
        sendMessage(payload.channelId, content, payload.parentId, payload.threadId);
    } else if (payload.recipientId) {
        // sendDirectMessage structure: sendDirectMessage(recipientId, content, parentId, threadId)
        // Need to ensure useSocket().sendDirectMessage supports parentId and threadId or use generic sendMessage
        // For now, assuming a generic `sendMessage` or adapting `send_message` event on backend
        sendDirectMessage(payload.recipientId, content, payload.parentId, payload.threadId);

    } else {
        console.error("Cannot determine if thread reply is for a channel or DM based on rootMessage context.");
    }
    // Potentially call onMessageSent here to trigger main list refresh for replyCount
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }


  if (isLoading) {
    return (
      <div className="w-full md:w-96 h-full bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 flex flex-col p-4 items-center justify-center">
        Loading thread...
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full md:w-96 h-full bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 flex flex-col p-4 items-center justify-center">
        <p className="text-red-500">{error}</p>
        <button onClick={fetchThread} className="mt-2 px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700">Retry</button>
      </div>
    );
  }

  if (!rootMessage) {
    return (
      <div className="w-full md:w-96 h-full bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 flex flex-col p-4 items-center justify-center">
        Thread not found.
      </div>
    );
  }

  return (
    <div className="w-full md:w-96 h-full bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Thread</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Replies to {rootMessage.user.name || rootMessage.user.username}'s message
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* Root Message Display (Simplified) */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <div className="flex gap-2.5">
          <div className="flex-shrink-0">
            {rootMessage.user.avatar ? (
              <img
                src={getAvatarUrl(rootMessage.user.avatar)}
                alt={rootMessage.user.name || rootMessage.user.username}
                className="w-9 h-9 rounded-md object-cover"
                onError={(e) => e.currentTarget.src = getAvatarUrl(null)}
              />
            ) : (
              <div className="w-9 h-9 bg-slate-600 dark:bg-slate-700 rounded-md flex items-center justify-center">
                <span className="text-white text-xs font-semibold">
                  {getInitials(rootMessage.user.name, rootMessage.user.username)}
                </span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-0.5">
              <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                {rootMessage.user.name || rootMessage.user.username}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {formatTime(rootMessage.createdAt)}
              </span>
            </div>
            <div className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words leading-normal text-sm">
              {rootMessage.content} {/* TODO: Use renderMessageContent for mentions */}
            </div>
          </div>
        </div>
      </div>

      {/* Replies */}
      <div className="flex-1 overflow-y-auto">
        <MessageList messages={replies} onViewThread={undefined} /> {/* onViewThread is undefined as we are already in a thread view */}
      </div>

      {/* Reply Composer */}
      <div className="mt-auto">
        <MessageComposer
          onSendMessage={handleSendReply}
          placeholder={`Reply to ${rootMessage.user.name || rootMessage.user.username}...`}
          workspaceMembers={workspaceMembers}
          // No channelId needed here as context is thread
          // Typing indicators for threads would be a further enhancement
        />
      </div>
    </div>
  );
}
