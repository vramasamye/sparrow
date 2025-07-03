'use client'

import { useState } from 'react'
import { CreateChannelModal } from './create-channel-modal'
import { InviteUserModal } from '../workspace/invite-user-modal'

import { getAvatarUrl, getInitials } from '@/utils/displayUtils'; // Import helpers

interface SidebarProps {
  workspace: any
  currentChannel: any
  currentDM: any // Added currentDM
  unreadDmSenders: Set<string>
  isCurrentUserAdmin?: boolean;
  currentUserRole?: MemberRole | null; // New prop for current user's role
  onChannelSelect: (channel: any) => void
  onChannelCreated: (channel: any) => void
  onMemberInvited: (member: any) => void
  onDirectMessage: (user: any) => void
}

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { MemberRole } from '@prisma/client';
import { usePresence } from '@/contexts/PresenceContext'; // Import usePresence

interface DMConversation {
  user: {
    id: string;
    username: string;
    name?: string;
    avatar?: string;
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
  const { presences } = usePresence();


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

  const handleRoleChange = async (targetUserId: string, newRole: MemberRole) => {
    if (!session || !workspace?.id || !isCurrentUserAdmin) return;

    const token = localStorage.getItem('token') || session.accessToken;
    try {
      const response = await fetch(`/api/workspaces/${workspace.id}/members/${targetUserId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to update role");
      }
      // Success - ideally, workspace data should refresh to reflect the change.
      // For now, an alert and then relying on a future full refresh or manual refresh.
      alert(`Role for user ${targetUserId} updated to ${newRole}. Please refresh if not immediately visible.`);
      // TODO: Implement a workspace data refresh mechanism instead of alert/reload
      // e.g., call a prop like `onWorkspaceDataNeededRefresh()`
      // Forcing a reload for now to see changes:
      window.location.reload();

    } catch (error: any) {
      console.error("Failed to change role:", error);
      alert(`Error changing role: ${error.message}`);
    }
  };


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
          {currentUserRole && currentUserRole !== MemberRole.GUEST && (
            <button
              onClick={() => setShowCreateChannel(true)}
              className="text-slate-400 hover:text-slate-200 hover:bg-slate-700 p-1 rounded transition-colors"
              title="Create channel"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
          )}
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
                  {convo.user.avatar ? (
                    <img
                      src={getAvatarUrl(convo.user.avatar)}
                      alt={convo.user.name || convo.user.username}
                      className="w-6 h-6 rounded-full object-cover"
                      onError={(e) => e.currentTarget.src = getAvatarUrl(null)}
                    />
                  ) : (
                    <div className="w-6 h-6 bg-slate-600 dark:bg-slate-700 rounded-full flex items-center justify-center">
                      <span className="text-white text-[10px] font-semibold">
                        {getInitials(convo.user.name, convo.user.username)}
                      </span>
                    </div>
                  )}
                  <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 border border-slate-800 rounded-full ${presences.get(convo.user.id)?.isOnline ? 'bg-green-400' : 'bg-slate-500'}`}></div>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className={`truncate flex items-center ${ currentDM?.id === convo.user.id || unreadDmSenders.has(convo.user.id) ? 'text-white' : 'text-slate-200' } group-hover:text-white`}>
                    <span>{convo.user.name || convo.user.username}</span>
                    {presences.get(convo.user.id)?.customStatusEmoji && (
                      <span className="ml-1.5 text-xs">{presences.get(convo.user.id)?.customStatusEmoji}</span>
                    )}
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
          {isCurrentUserAdmin && (
            <button
              onClick={() => setShowInviteUser(true)}
              className="text-slate-400 hover:text-slate-200 hover:bg-slate-700 p-1 rounded transition-colors"
              title="Invite user"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
          )}
        </div>
        
        <div className="space-y-1">
          {workspace?.members?.map((member: any) => (
            <button
              key={member.user.id}
              onClick={() => onDirectMessage(member.user)}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm text-slate-300 hover:bg-slate-700 hover:text-slate-100 group"
            >
              <div className="relative flex-shrink-0">
                {member.user.avatar ? (
                  <img
                    src={getAvatarUrl(member.user.avatar)}
                    alt={member.user.name || member.user.username}
                    className="w-6 h-6 rounded-full object-cover"
                    onError={(e) => e.currentTarget.src = getAvatarUrl(null)}
                  />
                ) : (
                  <div className="w-6 h-6 bg-slate-600 dark:bg-slate-700 rounded-full flex items-center justify-center">
                    <span className="text-white text-[10px] font-semibold">
                      {getInitials(member.user.name, member.user.username)}
                    </span>
                  </div>
                )}
                <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 border border-slate-800 rounded-full ${presences.get(member.user.id)?.isOnline ? 'bg-green-400' : 'bg-slate-500'}`}></div>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="truncate text-slate-200 group-hover:text-white flex items-center">
                  <span>{member.user.name || member.user.username}</span>
                  {presences.get(member.user.id)?.customStatusEmoji && (
                      <span className="ml-1.5 text-xs">{presences.get(member.user.id)?.customStatusEmoji}</span>
                  )}
                  {member.userId === session?.user?.id && <span className="text-xs text-slate-500 ml-1"> (You)</span>}
                </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 capitalize group-hover:text-slate-300">
                    {member.role.toLowerCase()}
                  </p>
              </div>
                {isCurrentUserAdmin && member.userId !== workspace?.ownerId && member.userId !== session?.user?.id && (
                  // Admins can change roles, but not for the owner or themselves via this simple UI
                  // A more complex UI might allow self-demotion if not last admin.
                  <div className="ml-auto pl-2 flex-shrink-0">
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.userId, e.target.value as MemberRole)}
                      onClick={(e) => e.stopPropagation()} // Prevent button click when changing select
                      className="text-xs bg-slate-700 dark:bg-slate-600 text-slate-200 dark:text-slate-100 border-slate-600 dark:border-slate-500 rounded p-0.5 focus:ring-1 focus:ring-indigo-500"
                      disabled={member.userId === workspace?.ownerId} // Extra safety: disable for owner
                    >
                      {Object.values(MemberRole).map((roleValue) => (
                        <option key={roleValue} value={roleValue}>
                          {roleValue.charAt(0).toUpperCase() + roleValue.slice(1).toLowerCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                 {isCurrentUserAdmin && member.userId === workspace?.ownerId && (
                    <span className="ml-auto pl-2 text-xs text-amber-400 flex-shrink-0">Owner</span>
                 )}
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