'use client'

import { useState } from 'react'
import { CreateChannelModal } from './create-channel-modal'
import { InviteUserModal } from '../workspace/invite-user-modal'

interface SidebarProps {
  workspace: any
  currentChannel: any
  currentDM: any // Added currentDM
  unreadDmSenders: Set<string> // Added unreadDmSenders
  onChannelSelect: (channel: any) => void
  onChannelCreated: (channel: any) => void
  onMemberInvited: (member: any) => void
  onDirectMessage: (user: any) => void
}

import { useEffect } from 'react'; // Added useEffect
import { useSession } from 'next-auth/react'; // Added useSession

interface DMConversation {
  user: {
    id: string;
    username: string;
    name?: string;
    avatar?: string; // Assuming avatar might be part of user object
  };
  lastMessage: {
    id: string;
    content: string;
    createdAt: string;
    userId: string; // ID of the sender of the last message
    user?: { username: string }; // Sender of the last message
  } | null;
}

export function Sidebar({ workspace, currentChannel, onChannelSelect, onChannelCreated, onMemberInvited, onDirectMessage }: SidebarProps) {
  const [showCreateChannel, setShowCreateChannel] = useState(false)
  const [showInviteUser, setShowInviteUser] = useState(false)
  const [dmConversations, setDmConversations] = useState<DMConversation[]>([])
  const [loadingDMs, setLoadingDMs] = useState(true)
  const { data: session } = useSession()


  useEffect(() => {
    const fetchDmConversations = async () => {
      if (!session) return;
      setLoadingDMs(true);
      try {
        const token = localStorage.getItem('token'); // Or from session if available directly
        const response = await fetch('/api/users/conversations', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
          throw new Error('Failed to fetch DM conversations');
        }
        const data = await response.json();
        if (data.conversations) {
          setDmConversations(data.conversations);
        }
      } catch (error) {
        console.error("Error fetching DM conversations:", error);
        setDmConversations([]); // Set to empty on error
      } finally {
        setLoadingDMs(false);
      }
    };

    fetchDmConversations();
    // TODO: Add a mechanism to refetch conversations when a new DM is sent/received
    // to ensure the list order and last message updates. This could be via a socket event
    // or by refetching when ChatInterface's currentDM changes.
  }, [session]);


  const handleChannelCreated = (channel: any) => {
    onChannelCreated(channel)
    setShowCreateChannel(false)
  }

  const handleMemberInvited = (member: any) => {
    onMemberInvited(member)
    setShowInviteUser(false)
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-800">
      {/* Channels Section */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
            Channels
          </h3>
          <button 
            onClick={() => setShowCreateChannel(true)}
            className="text-slate-400 hover:text-white hover:bg-slate-700 p-1 rounded transition-colors"
            title="Create channel"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
        </div>
        
        <div className="space-y-1">
          {workspace?.channels?.map((channel: any) => (
            <button
              key={channel.id}
              onClick={() => onChannelSelect(channel)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 group ${
                currentChannel?.id === channel.id
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`${currentChannel?.id === channel.id ? 'text-indigo-200' : 'text-slate-400 group-hover:text-slate-300'}`}>
                  #
                </span>
                <span className="truncate font-medium">{channel.name}</span>
                {channel.isPrivate && (
                  <svg className={`w-3 h-3 ${currentChannel?.id === channel.id ? 'text-indigo-200' : 'text-slate-400'}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              {channel.description && (
                <p className={`text-xs mt-1 truncate ${currentChannel?.id === channel.id ? 'text-indigo-200' : 'text-slate-400'}`}>
                  {channel.description}
                </p>
              )}
            </button>
          ))}
          
          {workspace?.channels?.length === 0 && (
            <div className="text-center py-4 text-slate-400">
              <p className="text-sm">No channels yet</p>
              <button
                onClick={() => setShowCreateChannel(true)}
                className="text-indigo-400 hover:text-indigo-300 text-sm mt-1"
              >
                Create your first channel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Direct Messages (Recent Conversations) Section */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
            Direct Messages
          </h3>
          {/* Maybe a '+' button here later to start a new DM via search */}
        </div>
        {loadingDMs ? (
          <div className="text-slate-400 text-xs py-2">Loading DMs...</div>
        ) : dmConversations.length > 0 ? (
          <div className="space-y-1">
            {dmConversations.map((convo) => (
              <button
                key={convo.user.id}
                onClick={() => onDirectMessage(convo.user)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors group ${
                  currentDM?.id === convo.user.id
                    ? 'bg-slate-700 text-white' // Selected DM style
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                } ${unreadDmSenders.has(convo.user.id) ? 'font-bold' : ''}`}
              >
                <div className="relative">
                  <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-cyan-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-semibold">
                      {convo.user.name?.[0]?.toUpperCase() || convo.user.username[0]?.toUpperCase()}
                    </span>
                  </div>
                  {/* TODO: Add online status indicator here based on actual presence */}
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 border-2 border-slate-800 rounded-full"></div>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className={`truncate group-hover:text-white ${currentDM?.id === convo.user.id || unreadDmSenders.has(convo.user.id) ? 'text-white' : 'text-slate-300' }`}>
                    {convo.user.name || convo.user.username}
                  </p>
                  {convo.lastMessage && (
                    <p className={`text-xs truncate group-hover:text-slate-300 ${currentDM?.id === convo.user.id ? 'text-slate-200' : 'text-slate-400'}`}>
                      {convo.lastMessage.userId === session?.user?.id ? 'You: ' : ''}
                      {convo.lastMessage.content}
                    </p>
                  )}
                </div>
                {unreadDmSenders.has(convo.user.id) && (
                  <span className="w-2.5 h-2.5 bg-red-500 rounded-full flex-shrink-0"></span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-slate-400 text-xs py-2">No recent direct messages.</div>
        )}
      </div>


      {/* Team Members Section (Original "Direct Messages Section") */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Team ({workspace?.members?.length || 0})
          </h3>
          <button 
            onClick={() => setShowInviteUser(true)}
            className="text-slate-400 hover:text-white hover:bg-slate-700 p-1 rounded transition-colors"
            title="Invite user"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
        </div>
        
        <div className="space-y-1">
          {workspace?.members?.map((member: any) => (
            <button
              key={member.user.id}
              onClick={() => onDirectMessage(member.user)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-700 transition-colors group"
            >
              <div className="relative">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-semibold">
                    {member.user.name?.[0]?.toUpperCase() || member.user.username[0]?.toUpperCase()}
                  </span>
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 border-2 border-slate-800 rounded-full"></div>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="truncate font-medium group-hover:text-white">
                  {member.user.name || member.user.username}
                </p>
                <p className="text-xs text-slate-400 capitalize">
                  {member.role.toLowerCase()}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Modals */}
      {showCreateChannel && (
        <CreateChannelModal
          onClose={() => setShowCreateChannel(false)}
          onChannelCreated={handleChannelCreated}
          workspaceId={workspace.id}
        />
      )}

      {showInviteUser && (
        <InviteUserModal
          onClose={() => setShowInviteUser(false)}
          onUserInvited={handleMemberInvited}
          workspaceId={workspace.id}
        />
      )}
    </div>
  )
}