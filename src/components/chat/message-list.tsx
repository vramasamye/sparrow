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
  reactions?: Reaction[]
  attachments?: Attachment[] // Add attachments array
}

interface Attachment {
  id: string;
  filename: string;
  mimetype: string;
  size: number;
  url: string; // This will be the unique filename for local dev, or full URL in prod
  createdAt: string;
  // uploader?: { id: string; username: string; name?: string }; // If needed
}

interface ReactionUser {
  id: string;
  username: string;
  name?: string;
}

interface Reaction {
  id?: string;
  emoji: string;
  userId: string;
  user: ReactionUser;
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
// useSession, useState, useRef, useEffect are already imported above or via React default
// No need for duplicate imports here

// ... (interfaces Message, ReactionUser, Reaction, MessageListProps)


export function MessageList({ messages, onViewThread }: MessageListProps) {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;

  const [showEmojiPickerFor, setShowEmojiPickerFor] = useState<string | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // State for message editing
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<string>("");
  const editInputRef = useRef<HTMLTextAreaElement>(null);


  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        // Check if the click was on an edit button, if so, don't close emoji picker.
        // This logic might need refinement if edit buttons are also within the picker's conceptual boundary.
        const targetElement = event.target as HTMLElement;
        if (!targetElement.closest('[title="Edit message"]')) {
          setShowEmojiPickerFor(null);
        }
      }
    }
    if (showEmojiPickerFor) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEmojiPickerFor]);

  const startEditHandler = (messageToEdit: Message) => {
    setEditingMessageId(messageToEdit.id);
    setEditedContent(messageToEdit.content);
    setShowEmojiPickerFor(null); // Close emoji picker if open
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditedContent("");
  };

  const handleSaveEdit = async () => {
    if (!editingMessageId || !session) return;
    const token = localStorage.getItem('token') || session.accessToken;

    try {
      const response = await fetch(`/api/messages/${editingMessageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ content: editedContent }),
      });

      if (!response.ok) {
        const errData = await response.json();
        console.error("API Error saving edit:", errData.error);
        alert(`Error: ${errData.error || 'Failed to save message edit'}`); // Basic error feedback
        // Optionally, don't close edit mode on API error, allow retry.
        return;
      }
      // Success: UI will update via socket event 'message_updated' from backend broadcast
      setEditingMessageId(null);
      setEditedContent("");
    } catch (error) {
      console.error("Failed to save message edit:", error);
      alert("An unexpected error occurred while saving.");
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!session) return;
    if (!window.confirm("Are you sure you want to delete this message? This action cannot be undone.")) {
      return;
    }

    const token = localStorage.getItem('token') || session.accessToken;
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        const errData = await response.json();
        console.error("API Error deleting message:", errData.error);
        alert(`Error: ${errData.error || 'Failed to delete message'}`);
        return;
      }
      // Success: UI will update via socket event 'message_deleted' from backend broadcast
      // No local state change needed here for deletion, rely on socket.
    } catch (error) {
      console.error("Failed to delete message:", error);
      alert("An unexpected error occurred while deleting the message.");
    }
  };

  // Auto-focus and select text (or move cursor to end) when editing starts
  useEffect(() => {
    if (editingMessageId && editInputRef.current) {
      editInputRef.current.focus();
      // Move cursor to end of text instead of selecting all
      const len = editInputRef.current.value.length;
      editInputRef.current.setSelectionRange(len, len);
    }
  }, [editingMessageId]);


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
                    {message.updatedAt && new Date(message.updatedAt).getTime() - new Date(message.createdAt).getTime() > 1000 * 5 && ( // Show if updated > 5s after created
                      <span className="ml-1 text-slate-400 dark:text-slate-500">(edited)</span>
                    )}
                  </span>
                </div>
                
                {editingMessageId === message.id ? (
                  <div className="mt-1">
                    <textarea
                      ref={editInputRef}
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSaveEdit();
                        } else if (e.key === 'Escape') {
                          handleCancelEdit();
                        }
                      }}
                      className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:ring-indigo-500 focus:border-indigo-500"
                      rows={Math.max(2, editedContent.split('\n').length)} // Auto-adjust rows based on content
                    />
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <button
                        onClick={handleCancelEdit}
                        className="px-3 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        className="px-3 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-md"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words leading-normal text-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-blockquote:my-1"
                    dangerouslySetInnerHTML={renderMessageContent(message.content)}
                  />
                  /* Added Tailwind Typography classes for basic Markdown styling:
                      prose prose-sm dark:prose-invert max-w-none
                      prose-p:my-1 etc. to reduce default prose margins for chat context
                  */
                )}

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

                {/* Display Attachments */}
                {message.attachments && message.attachments.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {message.attachments.map(attachment => (
                      <div key={attachment.id} className="p-2 border dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-700/30">
                        {attachment.mimetype.startsWith('image/') ? (
                          <img
                            src={`/api/files/view/${attachment.url}`} // URL for local dev serving
                            alt={attachment.filename}
                            className="max-w-xs max-h-64 rounded-md object-contain" // Constrain size
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            {/* Generic File Icon (placeholder) */}
                            <svg className="w-6 h-6 text-slate-500 dark:text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0011.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                            <div className="truncate">
                              <a
                                href={`/api/files/view/${attachment.url}?download=true`} // Add download query param
                                download={attachment.filename}
                                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium truncate"
                              >
                                {attachment.filename}
                              </a>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {Math.round(attachment.size / 1024)} KB
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

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
                  {/* Reply Icon SVG */}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                </button>
                {message.user.id === currentUserId && (
                  <>
                    {/* Edit Message Button */}
                    <button
                      title="Edit message"
                      onClick={() => startEditHandler(message)}
                      className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                    </button>
                    {/* Delete Message Button */}
                    <button
                      title="Delete message"
                      onClick={() => handleDeleteMessage(message.id)}
                      className="p-1 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-700/50 rounded"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                  </>
                )}
                {/* Placeholder: More Actions Button (can be removed if Edit/Delete are primary) */}
                {/* <button title="More actions" className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 rounded">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                </button> */}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}