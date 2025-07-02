'use client'

interface Message {
  id: string
  content: string
  createdAt: string
  user: {
    id: string
    username: string
    name?: string
    avatar?: string
  }
  replies?: Message[] // This might be used for inline display of first few replies or can be removed if all replies go to a panel
  parentId?: string | null
  threadId?: string | null
  replyCount?: number
  lastReplyAt?: string | null // ISO string
  reactions?: Reaction[] // Add reactions array
}

interface ReactionUser {
  id: string;
  username: string;
  name?: string;
}

interface Reaction {
  id?: string; // ID might not be needed on client if not directly manipulating by Reaction ID
  emoji: string;
  userId: string;
  user: ReactionUser; // User who made the reaction
  // messageId and createdAt usually not needed for display on client message
}


interface MessageListProps {
  messages: Message[]
  onViewThread?: (messageId: string) => void // Callback to open thread view
}

import { useSession } from 'next-auth/react'; // Import useSession
import { useState, useRef } from 'react'; // Import useState, useRef
import { EmojiPicker } from '../emoji/emoji-picker'; // Import EmojiPicker

import { marked } from 'marked'; // Import marked
import DOMPurify from 'dompurify'; // Import DOMPurify
import { useSession } from 'next-auth/react';
import { useState, useRef, useEffect } from 'react'; // Added useEffect here
import { EmojiPicker } from '../emoji/emoji-picker';

// ... (interfaces Message, ReactionUser, Reaction, MessageListProps)


export function MessageList({ messages, onViewThread }: MessageListProps) {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;

  const [showEmojiPickerFor, setShowEmojiPickerFor] = useState<string | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPickerFor(null);
      }
    }
    if (showEmojiPickerFor) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEmojiPickerFor]);


  const handleAddReaction = (messageId: string, emoji: string) => {
    const currentUserHasReactedWithThisEmoji = messages
      .find(m => m.id === messageId)?.reactions
      ?.some(r => r.emoji === emoji && r.userId === currentUserId);

    if (!currentUserHasReactedWithThisEmoji) {
      handleReactionClick(messageId, emoji, false);
    }
    setShowEmojiPickerFor(null);
  };

  const handleReactionClick = async (messageId: string, emoji: string, currentUserHasReacted: boolean) => {
    if (!session) return;
    const token = localStorage.getItem('token') || session.accessToken;
    const apiUrl = `/api/messages/${messageId}/reactions`;
    try {
      if (currentUserHasReacted) {
        await fetch(`${apiUrl}/${encodeURIComponent(emoji)}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        });
      } else {
        await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ emoji }),
        });
      }
    } catch (error) {
      console.error("Failed to update reaction:", error);
    }
  };

  // Configure marked (optional: override default options)
  // e.g., marked.setOptions({ gfm: true, breaks: true, ... });

  const renderMessageContent = (content: string) => {
    if (!content) return { __html: '' }; // Return empty __html for safety

    // First, handle @mentions by wrapping them in a custom element or a specific class
    // that Markdown parsing won't mangle, or that we can style specially.
    // For simplicity, we'll assume @mentions are part of the text that marked will process.
    // If specific click handlers or rich UIs are needed for mentions, a more complex pre-processing is needed.
    // The current regex approach for mentions within renderMessageContent won't work directly with dangerouslySetInnerHTML.
    // The Markdown parser will handle the text content. We need to style mentions via CSS if possible,
    // or enhance the Markdown parser/renderer.

    // For now, let's parse the whole content as Markdown.
    // Mentions like @username will be treated as plain text by `marked`.
    // We can re-introduce specific mention styling later if needed by post-processing the HTML
    // or by using a marked extension.

    const rawHtml = marked.parse(content) as string;
    const sanitizedHtml = typeof window !== 'undefined' ? DOMPurify.sanitize(rawHtml) : rawHtml; // Sanitize only on client-side

    return { __html: sanitizedHtml };
  };


  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    }
  }

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-lg font-medium text-slate-700">No messages yet</p>
          <p className="text-sm text-slate-500">Be the first to send a message!</p>
        </div>
      </div>
    )
  }

  let lastDate = ''

  return (
    <div className="p-4 space-y-3">
      {messages.map((message, index) => {
        const messageDate = formatDate(message.createdAt)
        const showDateDivider = messageDate !== lastDate
        lastDate = messageDate

        return (
          <div key={message.id}>
            {showDateDivider && (
              <div className="flex items-center my-4"> {/* Reduced my-6 to my-4 */}
                <div className="flex-1 border-t border-slate-200 dark:border-slate-700"></div> {/* Dark mode border */}
                <div className="px-3 py-0.5 text-xs font-medium text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm"> {/* Adjusted padding, bg, shadow */}
                  {messageDate}
                </div>
                <div className="flex-1 border-t border-slate-200 dark:border-slate-700"></div> {/* Dark mode border */}
              </div>
            )}
            {/* Reduced overall padding from p-3 to p-2, hover bg changed */}
            <div className="flex gap-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/50 p-2 rounded-lg transition-colors group relative">
              <div className="flex-shrink-0">
                 {/* Reduced avatar size from w-10 h-10 to w-9 h-9 */}
                {message.user.avatar ? (
                  <img src={message.user.avatar} alt={message.user.name || message.user.username} className="w-9 h-9 rounded-md object-cover"/>
                ) : (
                  <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-md flex items-center justify-center">
                    <span className="text-white text-xs font-semibold">
                      {message.user.name?.[0]?.toUpperCase() || message.user.username[0]?.toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5"> {/* Reduced mb-1 to mb-0.5 */}
                  <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm"> {/* Dark mode text */}
                    {message.user.name || message.user.username}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500"> {/* Always visible, dark mode text */}
                    {formatTime(message.createdAt)}
                  </span>
                </div>
                
                {/* Adjusted leading, dark mode text, and use dangerouslySetInnerHTML */}
                <div
                  className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words leading-normal text-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-blockquote:my-1"
                  dangerouslySetInnerHTML={renderMessageContent(message.content)}
                />
                {/* Added Tailwind Typography classes for basic Markdown styling:
                    prose prose-sm dark:prose-invert max-w-none
                    prose-p:my-1 etc. to reduce default prose margins for chat context
                */}

                {/* Thread indicator and replies link */}
                {(message.replyCount ?? 0) > 0 && (
                  <div className="mt-1.5">
                    <button
                      onClick={() => onViewThread && onViewThread(message.threadId || message.id)}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      {/* Placeholder for user avatars who replied - complex to implement fully here */}
                      {/* <span className="flex -space-x-1 overflow-hidden">
                        <img className="inline-block h-4 w-4 rounded-full ring-2 ring-white dark:ring-slate-800" src="https://via.placeholder.com/20" alt=""/>
                        <img className="inline-block h-4 w-4 rounded-full ring-2 ring-white dark:ring-slate-800" src="https://via.placeholder.com/20" alt=""/>
                      </span> */}
                      <span>{message.replyCount} {message.replyCount === 1 ? 'reply' : 'replies'}</span>
                       {message.lastReplyAt && (
                        <span className="text-slate-400 dark:text-slate-500 text-[10px]">
                          · Last reply {formatTime(message.lastReplyAt)}
                        </span>
                      )}
                    </button>
                  </div>
                )}
                 {/* The old message.replies block for inline display is removed in favor of thread panel */}

                {/* Display Reactions */}
                {message.reactions && message.reactions.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {Object.values( // Aggregate reactions by emoji
                      message.reactions.reduce((acc, reaction) => {
                        if (!acc[reaction.emoji]) {
                          // Initialize with the first user who reacted with this emoji
                          acc[reaction.emoji] = { emoji: reaction.emoji, count: 0, usersWhoReacted: [] };
                        }
                        acc[reaction.emoji].count++;
                        acc[reaction.emoji].usersWhoReacted.push(reaction.user); // reaction.user is {id, username, name}
                        return acc;
                      }, {} as Record<string, { emoji: string; count: number; usersWhoReacted: ReactionUser[] }>)
                    ).map(({ emoji, count, usersWhoReacted }) => {
                      const currentUserReacted = usersWhoReacted.some(u => u.id === currentUserId);
                      return (
                        <button
                          key={emoji}
                          onClick={() => handleReactionClick(message.id, emoji, currentUserReacted)}
                          title={usersWhoReacted.map(u => u.name || u.username).join(', ')}
                          className={`px-1.5 py-0.5 text-xs border rounded-full flex items-center gap-1 transition-colors ${
                            currentUserReacted
                              ? 'bg-indigo-100 dark:bg-indigo-700/50 border-indigo-300 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300'
                              : 'bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                          }`}
                        >
                          <span>{emoji}</span>
                          <span className="font-medium">{count}</span>
                        </button>
                      );
                    })}
                    {/* Placeholder for Add Reaction button directly on the reaction bar */}
                    {/* <button className="px-1.5 py-0.5 text-xs border rounded-full ...">+</button> */}
                  </div>
                )}
              </div>
              
              {/* Message Hover Actions - positioned top-right */}
              <div className="absolute top-1 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center space-x-0.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md shadow-sm p-0.5">
                {/* Emoji Reaction Button */}
                <div className="relative"> {/* Container for EmojiPicker positioning */}
                  <button
                    title="Add reaction"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent click from bubbling to message item
                      setShowEmojiPickerFor(showEmojiPickerFor === message.id ? null : message.id);
                    }}
                    className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </button>
                  {showEmojiPickerFor === message.id && (
                    <div ref={emojiPickerRef} className="absolute right-0 bottom-full mb-1"> {/* Position above and to the right */}
                      <EmojiPicker
                        onEmojiSelect={(emoji) => handleAddReaction(message.id, emoji)}
                        onClose={() => setShowEmojiPickerFor(null)}
                      />
                    </div>
                  )}
                </div>
                {/* Reply in Thread Button */}
                <button
                  title="Reply in thread"
                  onClick={() => onViewThread && onViewThread(message.threadId || message.id)}
                  className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                </button>
                {/* Placeholder: More Actions Button */}
                <button title="More actions" className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 rounded">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}