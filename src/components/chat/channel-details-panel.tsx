'use client'

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { getAvatarUrl, getInitials } from '@/utils/displayUtils';

interface User { // Simplified User, ensure it matches what your member list API returns
  id: string;
  username: string;
  name?: string | null;
  avatar?: string | null;
}

interface ChannelMember {
  userId: string;
  user: User;
  joinedAt: string; // Or Date
  // role: string; // Channel specific role, if any (not in current model)
}

interface Channel {
  id: string;
  name: string;
  description?: string | null;
  isPrivate: boolean;
  workspaceId: string;
  // createdBy, createdAt, etc.
}

interface ChannelDetailsPanelProps {
  channel: Channel;
  workspaceId: string; // Needed for API calls if not already in channel object
  onClose: () => void;
  isCurrentUserAdmin: boolean; // Workspace admin status for add/remove UI later
  // currentUserId: string; // For self-highlight or restrictions later
}

export function ChannelDetailsPanel({
  channel,
  workspaceId,
  onClose,
  isCurrentUserAdmin
}: ChannelDetailsPanelProps) {
  const { data: session } = useSession();
import { UserSearch } from './user-search'; // Import UserSearch

import { useSocket } from '@/hooks/useSocket'; // Import useSocket

// ... (existing interfaces)

export function ChannelDetailsPanel({
  channel,
  workspaceId,
  onClose,
  isCurrentUserAdmin
}: ChannelDetailsPanelProps) {
  const { data: session } = useSession();
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [error, setError] = useState<string | null>(null); // General error for panel
  const [showAddMemberSearch, setShowAddMemberSearch] = useState(false);
  const [addMemberError, setAddMemberError] = useState<string | null>(null);
  const [addMemberSuccess, setAddMemberSuccess] = useState<string | null>(null);
  const { onUserAddedToChannelHook, onUserRemovedFromChannelHook } = useSocket();
  const [isProcessingArchive, setIsProcessingArchive] = useState(false);

  // State for notification preferences
  type NotificationSetting = "ALL" | "MENTIONS" | "NONE";
  const [currentNotifSetting, setCurrentNotifSetting] = useState<NotificationSetting>("ALL"); // Default or fetched
  const [isSavingNotifSetting, setIsSavingNotifSetting] = useState(false);
  const [notifSettingError, setNotifSettingError] = useState<string | null>(null);


  const fetchMembers = useCallback(async () => {
    if (!channel?.id || !workspaceId || !session) return;
    setIsLoadingMembers(true);
    setError(null);
    try {
      const token = localStorage.getItem('token') || session.accessToken;
      const response = await fetch(`/api/workspaces/${workspaceId}/channels/${channel.id}/members`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to fetch channel members');
      }
      const data = await response.json();
      setMembers(data.members || []);
    } catch (err: any) {
      console.error("Fetch channel members error:", err);
      setError(err.message);
    } finally {
      setIsLoadingMembers(false);
    }
  }, [channel?.id, workspaceId, session]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Real-time updates for member list in this panel
  useEffect(() => {
    if (!channel?.id) return;

    const addedCleanup = onUserAddedToChannelHook((data) => {
      if (data.channelId === channel.id) {
        fetchMembers(); // Refetch members if someone was added to this channel
        // Or optimistically add: setMembers(prev => [...prev, { userId: data.userId, user: data.userDetails, joinedAt: new Date().toISOString() }]);
      }
    });

    const removedCleanup = onUserRemovedFromChannelHook((data) => {
      if (data.channelId === channel.id) {
        fetchMembers(); // Refetch members if someone was removed from this channel
        // Or optimistically remove: setMembers(prev => prev.filter(m => m.userId !== data.userId));
      }
    });

    return () => {
      addedCleanup();
      removedCleanup();
    };
  }, [channel?.id, fetchMembers, onUserAddedToChannelHook, onUserRemovedFromChannelHook]);


  const handleAddUserToChannel = async (userToAdd: User) => {
    if (!channel || !workspaceId || !session) {
        setAddMemberError("Cannot add member: Missing channel, workspace, or session information.");
        return;
    }
    setAddMemberError(null);
    setAddMemberSuccess(null);

    if (members.find(m => m.userId === userToAdd.id)) {
      setAddMemberError(`${userToAdd.name || userToAdd.username} is already a member of this channel.`);
      setShowAddMemberSearch(false);
      setTimeout(() => setAddMemberError(null), 3000); // Clear error after 3s
      return;
    }

    try {
      const token = localStorage.getItem('token') || session.accessToken;
      const response = await fetch(`/api/workspaces/${workspaceId}/channels/${channel.id}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: userToAdd.id }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add user to channel.');
      }
      setAddMemberSuccess(`${data.member.user.name || data.member.user.username} has been added.`);
      fetchMembers(); // Refetch members list
      setShowAddMemberSearch(false);
      setTimeout(() => setAddMemberSuccess(null), 3000); // Clear success after 3s
    } catch (err: any) {
      console.error("Add user to channel error:", err);
      setAddMemberError(err.message);
      setTimeout(() => setAddMemberError(null), 3000);
    }
  };

  const handleRemoveMember = async (targetUserId: string, targetUsername: string) => {
    if (!channel || !workspaceId || !session || !isCurrentUserAdmin) return;
    if (targetUserId === session.user?.id) {
      alert("You cannot remove yourself using this option. Use 'Leave Channel' elsewhere.");
      return;
    }
    // TODO: Add check for workspace owner if they should be unremovable from channels by other admins.
    // const workspaceOwnerId = workspace?.ownerId; // workspace prop is not directly available here
    // if (targetUserId === workspaceOwnerId) {
    //   alert("The workspace owner cannot be removed from channels by other admins.");
    //   return;
    // }


    if (!window.confirm(`Are you sure you want to remove ${targetUsername} from #${channel.name}?`)) {
      return;
    }

    // Use a generic error state for remove operations for now
    setAddMemberError(null);
    setAddMemberSuccess(null);

    try {
      const token = localStorage.getItem('token') || session.accessToken;
      const response = await fetch(`/api/workspaces/${workspaceId}/channels/${channel.id}/members/${targetUserId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove user from channel.');
      }
      setAddMemberSuccess(`${targetUsername} has been removed from the channel.`); // Use addMemberSuccess for general feedback
      fetchMembers(); // Refetch members list
    } catch (err: any) {
      console.error("Remove user from channel error:", err);
      setAddMemberError(err.message); // Use addMemberError for general feedback
      setTimeout(() => setAddMemberError(null), 3000);
    }
  };

  const handleArchiveChannel = async () => {
    if (!session || !channel || !workspaceId || !isCurrentUserAdmin) return;
    if (channel.name.toLowerCase() === 'general') {
        alert("The 'general' channel cannot be archived.");
        return;
    }
    setIsProcessingArchive(true);
    setError(null);
    try {
      const token = localStorage.getItem('token') || session.accessToken;
      const response = await fetch(`/api/workspaces/${workspaceId}/channels/${channel.id}/archive`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to archive channel');
      alert('Channel archived. UI may need a refresh to reflect changes across all components.');
      onClose(); // Close panel
      // TODO: Trigger global state refresh instead of window.location.reload()
      window.location.reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessingArchive(false);
    }
  };

  const handleUnarchiveChannel = async () => {
    if (!session || !channel || !workspaceId || !isCurrentUserAdmin) return;
    setIsProcessingArchive(true);
    setError(null);
    try {
      const token = localStorage.getItem('token') || session.accessToken;
      const response = await fetch(`/api/workspaces/${workspaceId}/channels/${channel.id}/unarchive`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to unarchive channel');
      alert('Channel unarchived. UI may need a refresh.');
      onClose();
      window.location.reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessingArchive(false);
    }
  };

  useEffect(() => {
    if (!channel?.id || !workspaceId || !session?.user?.id) return;

    const fetchNotifPreference = async () => {
      setNotifSettingError(null);
      try {
        const token = localStorage.getItem('token') || session.accessToken;
        const response = await fetch(`/api/notification-preferences?workspaceId=${workspaceId}&channelId=${channel.id}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed to fetch notification preference');
        }
        const data = await response.json();
        if (data.preferences && data.preferences.notificationSetting) { // API returns { preferences: object } or { preference: null }
          setCurrentNotifSetting(data.preferences.notificationSetting as NotificationSetting);
        } else {
          setCurrentNotifSetting("ALL"); // Default if no specific preference is set
        }
      } catch (err: any) {
        console.error("Fetch notif preference error:", err);
        setNotifSettingError("Could not load notification settings.");
        // setCurrentNotifSetting("ALL"); // Default on error
      }
    };
    fetchNotifPreference();
  }, [channel?.id, workspaceId, session]);

  const handleNotifSettingChange = async (newSetting: NotificationSetting) => {
    if (!channel?.id || !workspaceId || !session?.user?.id) return;

    setIsSavingNotifSetting(true);
    setNotifSettingError(null);
    try {
      const token = localStorage.getItem('token') || session.accessToken;
      const response = await fetch(`/api/notification-preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          workspaceId,
          channelId: channel.id,
          setting: newSetting
        }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to update notification preference');
      }
      const data = await response.json();
      setCurrentNotifSetting(data.preference.notificationSetting as NotificationSetting);
      // alert("Notification preference updated!"); // Or a more subtle feedback
    } catch (err: any) {
      console.error("Update notif preference error:", err);
      setNotifSettingError(err.message || "Failed to save setting.");
      // Revert optimistic update if any, or refetch to be sure
      // For now, currentNotifSetting might be out of sync if error occurs after optimistic set
    } finally {
      setIsSavingNotifSetting(false);
    }
  };


  return (
    <>
      <div className="fixed inset-y-0 right-0 w-full md:w-96 bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 shadow-xl z-30 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                #{channel.name}
              </h3>
              {channel.isPrivate && <p className="text-xs text-slate-500 dark:text-slate-400">Private Channel</p>}
            </div>
            <button onClick={onClose} className="p-1.5 text-slate-400 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          {channel.description && (
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">{channel.description}</p>
          )}
        </div>

        {/* Members List Section */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Members ({members.length})</h4>
              {isCurrentUserAdmin && ( // Permission check for adding members
                <button
                  onClick={() => setShowAddMemberSearch(true)}
                  className="text-xs px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md"
                >
                  Add Members
                </button>
              )}
          </div>
          {addMemberSuccess && <p className="text-xs text-green-500 my-1">{addMemberSuccess}</p>}
          {addMemberError && <p className="text-xs text-red-500 my-1">{addMemberError}</p>}
          {isLoadingMembers ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading members...</p>
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : members.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No members in this channel yet.</p>
        ) : (
          <ul className="space-y-2 max-h-60 overflow-y-auto">
            {members.map(member => (
              <li key={member.userId} className="flex items-center gap-3 p-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700">
                {member.user.avatar ? (
                  <img
                    src={getAvatarUrl(member.user.avatar)}
                    alt={member.user.name || member.user.username}
                    className="w-7 h-7 rounded-full object-cover"
                    onError={(e) => e.currentTarget.src = getAvatarUrl(null)}
                  />
                ) : (
                  <div className="w-7 h-7 bg-slate-600 dark:bg-slate-700 rounded-full flex items-center justify-center">
                    <span className="text-white text-[10px] font-semibold">
                      {getInitials(member.user.name, member.user.username)}
                    </span>
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{member.user.name || member.user.username}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">@{member.user.username}</p>
                </div>
                {isCurrentUserAdmin && member.userId !== session?.user?.id && (
                  // TODO: Add check for workspace owner if they are unremovable by other admins
                  <button
                    onClick={() => handleRemoveMember(member.userId, member.user.username)}
                    className="ml-auto p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-700/30 rounded-full"
                    title={`Remove ${member.user.username}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Other sections like "About", "Settings" for the channel can go here later */}
      <div className="flex-1 p-4 space-y-4">
        {/* Placeholder for more channel details or settings */}
        {isCurrentUserAdmin && channel.name.toLowerCase() !== 'general' && ( // Prevent archiving 'general' from UI too
          <div>
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Channel Actions</h4>
            {!channel.isArchived ? (
              <button
                onClick={handleArchiveChannel}
                disabled={isProcessingArchive}
                className="w-full text-sm px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md disabled:opacity-50 flex items-center justify-center"
              >
                {isProcessingArchive && <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                Archive Channel
              </button>
            ) : (
              <button
                onClick={handleUnarchiveChannel}
                disabled={isProcessingArchive}
                className="w-full text-sm px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md disabled:opacity-50 flex items-center justify-center"
              >
                 {isProcessingArchive && <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                Unarchive Channel
              </button>
            )}
            {error && <p className="text-xs text-red-500 mt-2">{error}</p>} {/* General error display for archive ops */}
          </div>
        )}
      </div>

      {/* Notification Preferences Section */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Notifications for #{channel.name}</h4>
        <div className="space-y-2">
          {(["ALL", "MENTIONS", "NONE"] as NotificationSetting[]).map((setting) => (
            <label key={setting} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="radio"
                name={`notif-setting-${channel.id}`}
                value={setting}
                checked={currentNotifSetting === setting}
                onChange={() => handleNotifSettingChange(setting)}
                disabled={isSavingNotifSetting}
                className="form-radio h-3.5 w-3.5 text-indigo-600 border-slate-300 dark:border-slate-600 focus:ring-indigo-500 dark:bg-slate-700 dark:checked:bg-indigo-500"
              />
              <span>
                {setting === "ALL" && "All new messages"}
                {setting === "MENTIONS" && "@mentions only"}
                {setting === "NONE" && "Nothing"}
              </span>
            </label>
          ))}
        </div>
        {notifSettingError && <p className="text-xs text-red-500 mt-2">{notifSettingError}</p>}
        {isSavingNotifSetting && <p className="text-xs text-slate-500 mt-2">Saving preference...</p>}
      </div>


      {/* Channel Actions (Archive/Unarchive) - moved to its own bordered section */}
      {isCurrentUserAdmin && channel.name.toLowerCase() !== 'general' && (
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Channel Actions</h4>
            {!channel.isArchived ? (
              <button
                onClick={handleArchiveChannel}
                disabled={isProcessingArchive}
                className="w-full text-sm px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md disabled:opacity-50 flex items-center justify-center"
              >
                {isProcessingArchive && <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                Archive Channel
              </button>
            ) : (
              <button
                onClick={handleUnarchiveChannel}
                disabled={isProcessingArchive}
                className="w-full text-sm px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md disabled:opacity-50 flex items-center justify-center"
              >
                 {isProcessingArchive && <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                Unarchive Channel
              </button>
            )}
            {error && <p className="text-xs text-red-500 mt-2">{error}</p>} {/* General error display for archive ops */}
        </div>
      )}

      <div className="flex-1 p-4 overflow-y-auto"> {/* Added overflow-y-auto to remaining content area */}
        {/* Placeholder for more channel details or settings */}
      </div>


      {showAddMemberSearch && (
        <UserSearch
          workspaceId={workspaceId} // Pass workspaceId to filter search
          onClose={() => setShowAddMemberSearch(false)}
          onUserSelect={(user) => {
            handleAddUserToChannel(user);
            // UserSearch calls its own onClose, so no need to call setShowAddMemberSearch(false) here
          }}
        />
      )}
    </div>
  </>
  );
}

// Removed external helper function definitions as they are now component methods
