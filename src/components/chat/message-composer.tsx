'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useSocket } from '@/hooks/useSocket'

interface MessageComposerProps {
  onSendMessage: (content: string) => void
  placeholder?: string
  channelId?: string
}

export function MessageComposer({ onSendMessage, placeholder = "Type a message...", channelId }: MessageComposerProps) {
  const [message, setMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout>()
  const { data: session } = useSession()
  const { startTyping, stopTyping } = useSocket()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (message.trim()) {
      onSendMessage(message.trim())
      setMessage('')
      handleStopTyping()
    }
  }

  const handleTyping = () => {
    if (!isTyping && channelId && session?.user) {
      setIsTyping(true)
      startTyping(channelId, session.user.id, session.user.username || session.user.name || 'User')
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      handleStopTyping()
    }, 1000)
  }

  const handleStopTyping = () => {
    if (isTyping && channelId && session?.user) {
      setIsTyping(false)
      stopTyping(channelId, session.user.id)
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [message])

  return (
    <div className="bg-white p-4">
      <form onSubmit={handleSubmit} className="flex gap-3">
        <div className="flex-1 relative">
          <div className="border border-slate-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value)
                handleTyping()
              }}
              onKeyDown={handleKeyDown}
              onBlur={handleStopTyping}
              placeholder={placeholder}
              className="w-full resize-none px-4 py-3 focus:outline-none max-h-32 min-h-[52px] placeholder-slate-400"
              rows={1}
            />
            
            {/* Formatting Toolbar */}
            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-t border-slate-200">
              <div className="flex gap-1">
                <button
                  type="button"
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded transition-colors"
                  title="Bold"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 4a1 1 0 011-1h3a3 3 0 110 6H6v2h3a3 3 0 110 6H6a1 1 0 01-1-1V4zm3 2H7v2h1a1 1 0 000-2zM7 12v2h1a1 1 0 000-2H7z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded transition-colors"
                  title="Italic"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10.5 3a1 1 0 00-1 1v12a1 1 0 001 1h1a1 1 0 001-1V4a1 1 0 00-1-1h-1z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded transition-colors"
                  title="Attach file"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded transition-colors"
                  title="Emoji"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </div>
              
              <div className="text-xs text-slate-500">
                <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-xs">Enter</kbd> to send, <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-xs">Shift</kbd> + <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-xs">Enter</kbd> for new line
              </div>
            </div>
          </div>
        </div>
        
        <button
          type="submit"
          disabled={!message.trim()}
          className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium self-end flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
          Send
        </button>
      </form>
    </div>
  )
}