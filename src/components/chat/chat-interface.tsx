'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { Sidebar } from './sidebar'
import { MessageArea } from './message-area'
import { DirectMessageArea } from './direct-message-area'
import { UserSearch } from './user-search'
import { useSocket } from '@/hooks/useSocket'

interface ChatInterfaceProps {
  workspace: any
  workspaces: any[]
  onWorkspaceChange: (workspace: any) => void
  onCreateWorkspace: () => void
}

export function ChatInterface({ 
  workspace, 
  workspaces, 
  onWorkspaceChange, 
  onCreateWorkspace 
}: ChatInterfaceProps) {
  const { data: session } = useSession()
  const [currentChannel, setCurrentChannel] = useState(null)
  const [currentDM, setCurrentDM] = useState(null)
  const [showUserSearch, setShowUserSearch] = useState(false)
  const { joinWorkspace, isConnected } = useSocket()

  useEffect(() => {
    if (workspace?.channels?.length > 0 && !currentChannel && !currentDM) {
      setCurrentChannel(workspace.channels[0])
    }
  }, [workspace, currentChannel, currentDM])

  useEffect(() => {
    if (workspace?.id && isConnected) {
      joinWorkspace(workspace.id)
    }
  }, [workspace?.id, isConnected, joinWorkspace])

  const handleDirectMessage = (user: any) => {
    setCurrentChannel(null)
    setCurrentDM(user)
  }

  const handleChannelSelect = (channel: any) => {
    setCurrentDM(null)
    setCurrentChannel(channel)
  }

  return (
    <div className="flex h-screen bg-slate-900">
      {/* Left Sidebar */}
      <div className="w-72 bg-slate-900 text-white flex flex-col shadow-2xl">
        {/* Workspace Header */}
        <div className="p-4 border-b border-slate-700 bg-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">
                  {workspace?.name?.[0]?.toUpperCase()}
                </span>
              </div>
              <div>
                <h1 className="font-semibold text-lg text-white">{workspace?.name}</h1>
                <p className="text-sm text-slate-400">{workspace?.members?.length} members</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowUserSearch(true)}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                title="Find users"
              >
                <svg className="w-5 h-5 text-slate-400 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
              <button
                onClick={() => signOut()}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                title="Sign out"
              >
                <svg className="w-5 h-5 text-slate-400 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <Sidebar
          workspace={workspace}
          currentChannel={currentChannel}
          onChannelSelect={handleChannelSelect}
          onChannelCreated={(channel) => {
            // Refresh workspace data or add channel to state
            window.location.reload() // Simple refresh for now
          }}
          onMemberInvited={(member) => {
            // Refresh workspace data or add member to state
            window.location.reload() // Simple refresh for now
          }}
          onDirectMessage={handleDirectMessage}
        />

        {/* User Info */}
        <div className="mt-auto p-4 border-t border-slate-700 bg-slate-800">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-semibold">
                  {session?.user?.name?.[0]?.toUpperCase() || session?.user?.username?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-400 border-2 border-slate-800 rounded-full"></div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-white">
                {session?.user?.name || session?.user?.username}
              </p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-xs text-slate-400">Online</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white">
        {currentChannel ? (
          <MessageArea channel={currentChannel} />
        ) : currentDM ? (
          <DirectMessageArea 
            otherUser={currentDM} 
            onClose={() => setCurrentDM(null)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-slate-50">
            <div className="text-center">
              <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">Welcome to {workspace?.name}</h3>
              <p className="text-slate-600">Select a channel or start a direct message</p>
              <div className="mt-6 text-sm text-slate-500">
                <p>💬 Click on a channel to join the conversation</p>
                <p>👋 Click on a team member to send a direct message</p>
                <p className="text-blue-600 mt-2">💬 Messaging ready (refresh to see new messages)</p>
                <p className="text-xs text-slate-400 mt-1">Real-time messaging will be added in the next update</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* User Search Modal */}
      {showUserSearch && (
        <UserSearch
          onClose={() => setShowUserSearch(false)}
          onUserSelect={handleDirectMessage}
        />
      )}
    </div>
  )
}