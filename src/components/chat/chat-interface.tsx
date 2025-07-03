'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { Sidebar } from './sidebar'
import { MessageArea } from './message-area'
import { DirectMessageArea } from './direct-message-area'
import { UserSearch } from './user-search'
import { NotificationBell } from '../notifications/notification-bell'
import { NotificationPanel } from '../notifications/notification-panel'
import { useSocket } from '@/hooks/useSocket'
import { getAvatarUrl, getInitials } from '@/utils/displayUtils'; // Import helpers


// Define Notification type structure - ideally import from a shared types file
interface Notification {
  id: string;
  type: string;
  sender: { id: string; username: string; name?: string; avatar?: string; };
  message?: { id: string; content: string; channelId?: string; recipientId?: string; workspaceId?: string; };
  channel?: { id: string; name: string; workspaceId?: string; };
  isRead: boolean;
  createdAt: string;
}


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
  const [showNotificationPanel, setShowNotificationPanel] = useState(false)
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const [unreadDmSenders, setUnreadDmSenders] = useState<Set<string>>(new Set()); // Track senders of unread DMs
  const {
    joinWorkspace,
    isConnected,
    onNewNotification,
    onUserJoinedChannel, // New
    onUserLeftChannel   // New
  } = useSocket()

  // Fetch initial notifications and unread count
  const fetchInitialNotifications = async () => {
    if (!session) return;
    try {
      const response = await fetch('/api/notifications?status=unread&limit=0'); // Get total unread
      const data = await response.json();
      if (data && typeof data.totalUnread === 'number') {
        setUnreadNotificationCount(data.totalUnread);
      }
    } catch (error) {
      console.error('Failed to fetch initial unread notification count:', error);
    }
  };

  useEffect(() => {
    fetchInitialNotifications();
  }, [session]);


  // Listen for new notifications from socket
  useEffect(() => {
    if (!onNewNotification) return;

    const cleanup = onNewNotification((notification: Notification) => {
      setUnreadNotificationCount(prev => prev + 1);

      if (notification.type === 'new_dm' && notification.sender?.id) {
        // Only add if the DM is not currently open with that sender
        if (currentDM?.id !== notification.sender.id) {
          setUnreadDmSenders(prev => new Set(prev).add(notification.sender.id));
        }
      }

      // Optionally, trigger a browser notification
      if (Notification.permission === "granted") {
        new window.Notification(`New notification from ${notification.sender.name || notification.sender.username}`, {
          body: notification.message?.content.substring(0, 100) || `You have a new ${notification.type} notification.`,
          icon: '/favicon.ico' // Replace with actual sender avatar if available
        });
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
          if (permission === "granted") {
            // Can show notification now
          }
        });
      }
    });
    return cleanup;
  }, [onNewNotification, currentDM?.id]); // Added currentDM.id to dependencies

  // Listen for channel join/leave events
  useEffect(() => {
    if (!onUserJoinedChannel || !onUserLeftChannel || !workspace?.id || !session?.user?.id) return;

    const joinedCleanup = onUserJoinedChannel((data: any) => {
      if (data.workspaceId === workspace.id) {
        // console.log('User joined channel in this workspace:', data);
        // TODO: Update workspace data more gracefully.
        // This could involve the parent `Dashboard` page refetching or `ChatInterface`
        // managing its own copy of `workspace` if it's modified.
        // For now, we can inform the user or try a less disruptive update if possible.
        // A full refetch from onWorkspaceChange might be too broad if it resets other UI states.
        // Consider if `workspace` prop itself needs to be updated via `onWorkspaceChange`
        // or if a more specific callback like `onWorkspaceDataChange` is needed.
        alert(`User ${data.username} joined channel ${data.channelName}. Workspace data may need refresh.`);
        // Potentially, if the workspace object is managed by ChatInterface's parent (Dashboard),
        // we might need a callback like `requestWorkspaceRefresh()`
      }
    });

    const leftCleanup = onUserLeftChannel((data: any) => {
      if (data.workspaceId === workspace.id) {
        // console.log('User left channel in this workspace:', data);
        // TODO: Update workspace data.
        alert(`User ${data.username} left channel ${data.channelId}. Workspace data may need refresh.`);
        if (data.userId === session.user.id && currentChannel?.id === data.channelId) {
          // Current user left the currently viewed channel
          if (workspace.channels && workspace.channels.length > 0) {
            const generalChannel = workspace.channels.find((ch:any) => ch.name === 'general') ||
                                   workspace.channels.find((ch:any) => !ch.isPrivate) || // find any public
                                   workspace.channels[0]; // find any
            if (generalChannel) {
                handleChannelSelect(generalChannel);
            } else {
                 setCurrentChannel(null); // No other channels to select
            }
          } else {
            setCurrentChannel(null);
          }
        }
      }
    });

    return () => {
      joinedCleanup();
      leftCleanup();
    };
  }, [onUserJoinedChannel, onUserLeftChannel, workspace, session?.user?.id, currentChannel?.id, handleChannelSelect]); // Added handleChannelSelect to dependencies

  const handleMarkNotificationAsRead = async (notificationId: string) => {
    if (!session) return;
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.accessToken}` } // Assuming token is on session.accessToken
      });
      if (!response.ok) throw new Error('Failed to mark notification as read');
      // Optimistic update handled by NotificationPanel, or could refetch here
      // setUnreadNotificationCount(prev => Math.max(0, prev - 1)); // Panel also does this
    } catch (error) {
      console.error('Error marking notification as read:', error);
      // Revert optimistic update if needed
    }
  };

  const handleMarkAllNotificationsAsRead = async () => {
    if (!session) return;
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.accessToken}` }
      });
      if (!response.ok) throw new Error('Failed to mark all notifications as read');
      setUnreadNotificationCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    // Basic navigation logic, can be expanded
    // console.log("Notification clicked:", notification);
    if (notification.channelId && workspace?.id) {
        const targetChannel = workspace.channels.find((c:any) => c.id === notification.channelId);
        if (targetChannel) {
            handleChannelSelect(targetChannel);
        }
    } else if (notification.recipientId && notification.sender) { // For DMs
        // This assumes recipientId on the message is the current user for a received DM notification
        // And sender is the "otherUser" for the DM context.
        // Need to ensure `workspace.members` contains all users or have a way to fetch user by ID.
        const dmUser = workspace.members.find((m:any) => m.user.id === notification.sender.id)?.user;
        if (dmUser) {
            handleDirectMessage(dmUser);
        }
    }
    setShowNotificationPanel(false); // Close panel after click
  };


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

  const handleDirectMessage = async (user: any) => {
    setCurrentChannel(null)
    setCurrentDM(user)

    // Clear unread DM sender indicator for this user
    setUnreadDmSenders(prev => {
      const newSet = new Set(prev);
      newSet.delete(user.id);
      return newSet;
    });

    // Mark actual 'new_dm' notifications from this user as read on the backend
    if (session) {
      try {
        // First, fetch unread 'new_dm' notifications from this specific sender
        const response = await fetch(`/api/notifications?status=unread&type=new_dm&senderId=${user.id}`, {
            headers: { 'Authorization': `Bearer ${session.accessToken}` }
        });
        if (response.ok) {
            const { notifications: dmNotificationsToRead } = await response.json();
            for (const notif of dmNotificationsToRead) {
                if (notif.sender.id === user.id) { // Double check sender
                    await fetch(`/api/notifications/${notif.id}/read`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${session.accessToken}` }
                    });
                    // Decrement global unread count as these are marked read
                    setUnreadNotificationCount(prev => Math.max(0, prev - 1));
                }
            }
        }
      } catch (error) {
        console.error("Failed to mark DM notifications as read:", error);
      }
    }
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
              <NotificationBell
                onClick={() => setShowNotificationPanel(prev => !prev)}
+                initialUnreadCount={unreadNotificationCount}
+                setUnreadCount={setUnreadNotificationCount}
+              />
+              <button
+                onClick={() => signOut()}
+                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
+                title="Sign out"
+              >
+                <svg className="w-5 h-5 text-slate-400 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
+                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
+                </svg>
+              </button>
+            </div>
+          </div>
+        </div>
+
+        <Sidebar
          workspace={workspace}
          currentChannel={currentChannel}
          currentDM={currentDM} // Pass currentDM
          unreadDmSenders={unreadDmSenders} // Pass unreadDmSenders
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
              {session?.user?.image ? ( // Assuming next-auth session.user.image might hold avatar URL
                <img
                  src={getAvatarUrl(session.user.image)}
                  alt={session.user.name || session.user.username || "User"}
                  className="w-10 h-10 rounded-full object-cover"
                  onError={(e) => e.currentTarget.src = getAvatarUrl(null)}
                />
              ) : (
                <div className="w-10 h-10 bg-slate-600 dark:bg-slate-700 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">
                    {getInitials(session?.user?.name, session?.user?.username)}
                  </span>
                </div>
              )}
              {/* TODO: Dynamic presence indicator based on socket connection or user status */}
              <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 border-2 border-slate-800 rounded-full ${isConnected ? 'bg-green-400' : 'bg-slate-500'}`}></div>
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
          <MessageArea channel={currentChannel} workspaceMembers={workspace?.members || []} />
        ) : currentDM ? (
          <DirectMessageArea 
            otherUser={currentDM} 
            workspaceId={workspace?.id} // Pass workspaceId
            workspaceMembers={workspace?.members || []}
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

      <NotificationPanel
        isOpen={showNotificationPanel}
        onClose={() => setShowNotificationPanel(false)}
        onNotificationClick={handleNotificationClick}
        onMarkAsRead={handleMarkNotificationAsRead}
        onMarkAllAsRead={handleMarkAllNotificationsAsRead}
        setUnreadCount={setUnreadNotificationCount} // Pass down to keep count in sync
        // Pass session or token if NotificationPanel makes its own API calls
      />
    </div>
  )
}