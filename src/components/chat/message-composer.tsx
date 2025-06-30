'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useSocket } from '@/hooks/useSocket'

interface WorkspaceMember {
  user: {
    id: string
    username: string
    name?: string
  }
  // other member props like role if needed
}

interface MessageComposerProps {
  onSendMessage: (content: string) => void
  placeholder?: string
  channelId?: string // For channel-based typing indicators
  workspaceMembers?: WorkspaceMember[]
  // Generic typing handlers for DM or other contexts
  onStartTyping?: () => void
  onStopTyping?: () => void
}

export function MessageComposer({
  onSendMessage,
  placeholder = "Type a message...",
  channelId,
  workspaceMembers = [],
  onStartTyping,
  onStopTyping
}: MessageComposerProps) {
  const [message, setMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false) // Local state to manage timeout
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout>()
  const { data: session } = useSession()
  // Socket methods for channel typing are still here, but will only be called if channelId is present
  const { startTyping: startChannelTyping, stopTyping: stopChannelTyping } = useSocket()

  // For @mention suggestions
  const [mentionQuery, setMentionQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionPosition, setSuggestionPosition] = useState({ top: 0, left: 0 })
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0)

  const filteredMembers = mentionQuery
    ? workspaceMembers.filter(member =>
        member.user.username.toLowerCase().includes(mentionQuery.toLowerCase()) ||
        (member.user.name && member.user.name.toLowerCase().includes(mentionQuery.toLowerCase()))
      ).slice(0, 5) // Limit suggestions
    : []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (message.trim()) {
      onSendMessage(message.trim())
      setMessage('')
      setShowSuggestions(false)
      handleStopTyping()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setMessage(text)
    handleTyping()

    const cursorPos = e.target.selectionStart
    const textBeforeCursor = text.substring(0, cursorPos)
    const atMatch = textBeforeCursor.match(/@([\w.-]*)$/)

    if (atMatch) {
      const query = atMatch[1]
      setMentionQuery(query)
      setShowSuggestions(true)
      setActiveSuggestionIndex(0)

      // Calculate position for suggestions dropdown
      // This is a simplified positioning, might need a library for robustness
      const rect = e.target.getBoundingClientRect()
      // Attempt to get cursor position, needs more advanced handling for precise x,y
      // For now, position below the textarea input.
      setSuggestionPosition({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX })

    } else {
      setShowSuggestions(false)
      setMentionQuery('')
    }
  }

  const handleSelectMention = (username: string) => {
    const cursorPos = textareaRef.current?.selectionStart ?? message.length
    const textBeforeCursor = message.substring(0, cursorPos)
    const atMatch = textBeforeCursor.match(/@([\w.-]*)$/)

    if (atMatch) {
      const queryLength = atMatch[1].length
      const startOfMention = cursorPos - queryLength -1 // -1 for '@'
      const newMessage =
        message.substring(0, startOfMention) +
        `@${username} ` +
        message.substring(cursorPos)
      setMessage(newMessage)
      setShowSuggestions(false)
      setMentionQuery('')
      textareaRef.current?.focus()
    }
  }


  const handleTyping = () => {
    if (!isTyping && session?.user) {
      setIsTyping(true)
      if (onStartTyping) {
        onStartTyping()
      } else if (channelId) { // Fallback to channel typing if no specific handler
        startChannelTyping(channelId) // Note: startChannelTyping might need more params if you updated its signature
      }
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
    if (isTyping && session?.user) {
      setIsTyping(false)
      if (onStopTyping) {
        onStopTyping()
      } else if (channelId) { // Fallback to channel typing
        stopChannelTyping(channelId) // Note: stopChannelTyping might need more params if you updated its signature
      }
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveSuggestionIndex(prev => (prev + 1) % filteredMembers.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveSuggestionIndex(prev => (prev - 1 + filteredMembers.length) % filteredMembers.length)
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (!e.shiftKey) { // Allow Shift+Enter for newline
          e.preventDefault()
          handleSelectMention(filteredMembers[activeSuggestionIndex].user.username)
        }
      } else if (e.key === 'Escape') {
        setShowSuggestions(false)
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as React.FormEvent)
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
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                handleStopTyping()
                // Delay hiding suggestions to allow click
                setTimeout(() => setShowSuggestions(false), 100)
              }}
              placeholder={placeholder}
              className="w-full resize-none px-4 py-3 focus:outline-none max-h-32 min-h-[52px] placeholder-slate-400"
              rows={1}
            />

            {showSuggestions && filteredMembers.length > 0 && (
              <div
                className="absolute z-10 w-full max-w-xs bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden"
                style={{
                  bottom: '100%', // Position above the input area
                  left: 0, // Align with left of input area, adjust as needed
                  marginBottom: '8px' // Small gap
                }}
              >
                <ul className="max-h-48 overflow-y-auto">
                  {filteredMembers.map((member, index) => (
                    <li key={member.user.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectMention(member.user.username)}
                        className={`w-full text-left px-4 py-2 text-sm ${
                          index === activeSuggestionIndex ? 'bg-indigo-500 text-white' : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className="font-medium">{member.user.name || member.user.username}</span>
                        <span className={`ml-2 ${index === activeSuggestionIndex ? 'text-indigo-200' : 'text-slate-500'}`}>
                          @{member.user.username}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
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