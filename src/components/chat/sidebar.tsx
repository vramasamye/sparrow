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
      <div className="p-3 border-b border-slate-700"> {/* Reduced p-4 to p-3 */}
        <div className="flex items-center justify-between mb-2"> {/* Reduced mb-4 to mb-2 */}
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"> {/* Smaller text, lighter color, wider tracking, smaller gap */}
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"> {/* Slightly smaller icon */}
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
            Channels
          </h3>
          <button 
            onClick={() => setShowCreateChannel(true)}
            className="text-slate-400 hover:text-slate-200 hover:bg-slate-700 p-1 rounded transition-colors"
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
              className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors group ${ // py-1.5 for density, rounded-md
                currentChannel?.id === channel.id
                  ? 'bg-slate-600 text-white font-semibold' // Updated selected style
                  : 'text-slate-200 hover:bg-slate-700 hover:text-white' // Updated base and hover
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`${currentChannel?.id === channel.id ? 'text-slate-300' : 'text-slate-500 group-hover:text-slate-400'}`}>
                  #
                </span>
                <span className={`truncate ${currentChannel?.id === channel.id ? 'font-semibold' : 'font-medium'}`}>{channel.name}</span>
                {channel.isPrivate && (
                  <svg className={`w-3 h-3 flex-shrink-0 ${currentChannel?.id === channel.id ? 'text-slate-300' : 'text-slate-500'}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              {/* Description can be removed for density, or kept if important */}
              {/* {channel.description && (
                <p className={`text-xs mt-0.5 truncate ${currentChannel?.id === channel.id ? 'text-slate-300' : 'text-slate-400'}`}>
                  {channel.description}
                </p>
              )} */}
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
      <div className="p-3 border-b border-slate-700"> {/* Reduced p-4 to p-3 */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"> {/* Matched style */}
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg> {/* Matched style */}
            Direct Messages
          </h3>
          {/* Maybe a '+' button here later to start a new DM via search */}
        </div>
        {loadingDMs ? (
          <div className="text-slate-400 text-xs py-2 px-3">Loading DMs...</div> {/* Added px-3 for alignment */}
        ) : dmConversations.length > 0 ? (
          <div className="space-y-1">
            {dmConversations.map((convo) => (
              <button
                key={convo.user.id}
                onClick={() => onDirectMessage(convo.user)}
                className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors group ${ // gap-2.5
                  currentDM?.id === convo.user.id
                    ? 'bg-slate-600 text-white font-semibold' // Updated selected DM style
                    : unreadDmSenders.has(convo.user.id)
                      ? 'text-white font-semibold hover:bg-slate-700' // Unread style
                      : 'text-slate-300 hover:bg-slate-700 hover:text-slate-100' // Default
                }`}
              >
                <div className="relative flex-shrink-0">
                  {/* Basic avatar placeholder, replace with actual image if available */}
                  <div className="w-6 h-6 bg-gradient-to-br from-sky-500 to-cyan-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-[10px] font-semibold">
                      {convo.user.name?.[0]?.toUpperCase() || convo.user.username[0]?.toUpperCase()}
                    </span>
                  </div>
                  {/* TODO: Add dynamic online status indicator */}
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 border border-slate-800 rounded-full"></div>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className={`truncate ${ currentDM?.id === convo.user.id || unreadDmSenders.has(convo.user.id) ? 'text-white' : 'text-slate-200' } group-hover:text-white`}>
                    {convo.user.name || convo.user.username}
                  </p>
                  {convo.lastMessage && (
                    <p className={`text-xs truncate ${currentDM?.id === convo.user.id ? 'text-slate-300' : 'text-slate-400'} group-hover:text-slate-300`}>
                      {convo.lastMessage.userId === session?.user?.id ? 'You: ' : ''}
                      {convo.lastMessage.content}
                    </p>
                  )}
                </div>
                {unreadDmSenders.has(convo.user.id) && ! (currentDM?.id === convo.user.id) && ( // Show dot only if unread AND not currently selected
                  <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0 ml-auto"></span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-slate-400 text-xs py-2">No recent direct messages.</div>
        )}
      </div>


      {/* Team Members Section (Original "Direct Messages Section") */}
      <div className="p-3"> {/* Reduced p-4 to p-3 */}
        <div className="flex items-center justify-between mb-2"> {/* Reduced mb-4 to mb-2 */}
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"> {/* Matched style */}
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"> {/* Matched style */}
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Team ({workspace?.members?.length || 0})
          </h3>
          <button 
            onClick={() => setShowInviteUser(true)}
            className="text-slate-400 hover:text-slate-200 hover:bg-slate-700 p-1 rounded transition-colors"
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
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm text-slate-300 hover:bg-slate-700 hover:text-slate-100 group"
            >
              <div className="relative flex-shrink-0">
                 <div className="w-6 h-6 bg-gradient-to-br from-slate-500 to-slate-600 rounded-full flex items-center justify-center"> {/* Consistent avatar size */}
                  <span className="text-white text-[10px] font-semibold">
                    {member.user.name?.[0]?.toUpperCase() || member.user.username[0]?.toUpperCase()}
                  </span>
                </div>
                {/* TODO: Dynamic online status indicator */}
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 border border-slate-800 rounded-full"></div>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="truncate text-slate-200 group-hover:text-white">
                  {member.user.name || member.user.username}
                </p>
                {/* Role can be removed for cleaner DM list, or kept if important for context */}
                {/* <p className="text-xs text-slate-400 capitalize group-hover:text-slate-300">
                  {member.role.toLowerCase()}
                </p> */}
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