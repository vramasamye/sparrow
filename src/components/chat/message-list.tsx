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
              <div className="flex items-center my-6">
                <div className="flex-1 border-t border-slate-200"></div>
                <div className="px-4 py-1 text-xs font-medium text-slate-500 bg-slate-50 rounded-full border border-slate-200">
                  {messageDate}
                </div>
                <div className="flex-1 border-t border-slate-200"></div>
              </div>
            )}
            
            <div className="flex gap-3 hover:bg-white p-3 rounded-xl transition-colors group">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">
                    {message.user.name?.[0]?.toUpperCase() || message.user.username[0]?.toUpperCase()}
                  </span>
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-semibold text-slate-900">
                    {message.user.name || message.user.username}
                  </span>
                  <span className="text-xs text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    {formatTime(message.createdAt)}
                  </span>
                </div>
                
                <div className="text-slate-800 whitespace-pre-wrap break-words leading-relaxed">
                  {message.content}
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
              
              <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex gap-1">
                  <button className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </button>
                  <button className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}