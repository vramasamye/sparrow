'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { MessageList } from './message-list'
import { MessageComposer } from './message-composer'
import { useSocket } from '@/hooks/useSocket'

interface DirectMessageAreaProps {
  otherUser: {
    id: string
    username: string
    name?: string
    avatar?: string
  }
  onClose: () => void
}

export function DirectMessageArea({ otherUser, onClose }: DirectMessageAreaProps) {
  const { data: session } = useSession()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [dmChannel, setDmChannel] = useState<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { sendDirectMessage, onNewDirectMessage, joinChannel, isConnected } = useSocket()

  useEffect(() => {
    loadDirectMessages()
  }, [otherUser.id])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (dmChannel?.id) {
      joinChannel(dmChannel.id)
    }
  }, [dmChannel?.id, joinChannel])

  useEffect(() => {
    const cleanup = onNewDirectMessage((newMessage) => {
      setMessages(prev => [...prev, newMessage])
    })
    return cleanup
  }, [onNewDirectMessage])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadDirectMessages = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/direct-messages?userId=${otherUser.id}`)
      const data = await response.json()
      
      if (data.channel && data.messages) {
        setDmChannel(data.channel)
        setMessages(data.messages)
      }
    } catch (error) {
      console.error('Failed to load direct messages:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSendMessage = async (content: string) => {
    try {
      const response = await fetch('/api/direct-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          recipientId: otherUser.id,
        }),
      })

      const data = await response.json()
      
      if (data.message) {
        setMessages(prev => [...prev, data.message])
        
        // Send real-time message if connected
        if (isConnected) {
          sendDirectMessage(otherUser.id, data.message)
        }
      }
    } catch (error) {
      console.error('Failed to send direct message:', error)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* DM Header */}
      <div className="border-b border-slate-200 p-4 bg-white shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors lg:hidden"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">
                    {otherUser.name?.[0]?.toUpperCase() || otherUser.username[0]?.toUpperCase()}
                  </span>
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 border-2 border-white rounded-full"></div>
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">
                  {otherUser.name || otherUser.username}
                </h2>
                <p className="text-sm text-slate-500">
                  @{otherUser.username}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </button>
            <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
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
            <MessageList messages={messages} />
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Composer */}
      <div className="bg-white border-t border-slate-200">
        <MessageComposer 
          onSendMessage={handleSendMessage}
          placeholder={`Message ${otherUser.name || otherUser.username}`}
        />
      </div>
    </div>
  )
}