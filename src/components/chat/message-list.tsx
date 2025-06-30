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
  replies?: Message[]
}

interface MessageListProps {
  messages: Message[]
}

export function MessageList({ messages }: MessageListProps) {
  const renderMessageContent = (content: string) => {
    if (!content) return null;
    const mentionRegex = /(@[\w.-]+)/g; // Regex to find @username patterns
    const parts = content.split(mentionRegex);

    return parts.map((part, index) => {
      if (mentionRegex.test(part)) {
        // It's a mention
        return (
          <span key={index} className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline cursor-pointer">
            {part}
          </span>
        );
      }
      // It's a normal text part
      return part;
    });
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
                
                {/* Adjusted leading, dark mode text */}
                <div className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words leading-normal text-sm">
                  {renderMessageContent(message.content)}
                </div>

                {message.replies && message.replies.length > 0 && (
                  <div className="mt-3 ml-4 border-l-2 border-indigo-200 pl-4 space-y-2 bg-indigo-50 rounded-r-lg p-3">
                    <div className="text-xs font-medium text-indigo-700 mb-2">
                      {message.replies.length} {message.replies.length === 1 ? 'reply' : 'replies'}
                    </div>
                    {message.replies.map((reply) => (
                      <div key={reply.id} className="flex gap-2">
                        <div className="w-6 h-6 bg-gradient-to-br from-slate-400 to-slate-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-medium">
                            {reply.user.name?.[0]?.toUpperCase() || reply.user.username[0]?.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm font-medium text-slate-700">
                              {reply.user.name || reply.user.username}
                            </span>
                            <span className="text-xs text-slate-500">
                              {formatTime(reply.createdAt)}
                            </span>
                          </div>
                          <div className="text-sm text-slate-800 mt-1">
                            {reply.content}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Message Hover Actions - positioned top-right */}
              <div className="absolute top-1 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center space-x-0.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md shadow-sm p-0.5">
                {/* Placeholder: Emoji Reaction Button */}
                <button title="Add reaction" className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 rounded">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </button>
                {/* Placeholder: Reply in Thread Button */}
                <button title="Reply in thread" className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 rounded">
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