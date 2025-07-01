'use client'

import { useState, useEffect, useCallback } from 'react'
// import { useSession } from 'next-auth/react'
// import { useSocket } from '@/hooks/useSocket' // For real-time updates if panel is open

interface Notification {
  id: string;
  type: 'mention' | 'new_dm' | string; // Add other types as needed
  sender: {
    id: string;
    username: string;
    name?: string;
    avatar?: string;
  };
  message?: {
    id: string;
    content: string;
    channelId?: string;
    recipientId?: string;
    workspaceId?: string;
  };
  channel?: {
    id: string;
    name: string;
    workspaceId?: string;
  };
  isRead: boolean;
  createdAt: string;
}

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onNotificationClick?: (notification: Notification) => void; // To handle navigation
  onMarkAsRead?: (notificationId: string) => Promise<void>;
  onMarkAllAsRead?: () => Promise<void>;
  setUnreadCount?: (count: number | ((prev: number) => number)) => void;
}

const mockNotifications: Notification[] = [
  {
    id: '1', type: 'mention',
    sender: { id: 'user2', username: 'bob_ux', name: 'Bob UX' },
    message: { id: 'msg1', content: 'Hey @alice_dev check this out in #general', channelId: 'chan1', workspaceId: 'ws1' },
    channel: { id: 'chan1', name: 'general', workspaceId: 'ws1'},
    isRead: false, createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString()
  },
  {
    id: '2', type: 'new_dm',
    sender: { id: 'user3', username: 'charlie_pm', name: 'Charlie PM' },
    message: { id: 'dm1', content: 'Quick question about the roadmap.', recipientId: 'user1', workspaceId: 'ws1' },
    isRead: false, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
  },
  {
    id: '3', type: 'mention',
    sender: { id: 'user4', username: 'dave_qa', name: 'Dave QA' },
    message: { id: 'msg2', content: 'Can you look at this bug report @alice_dev?', channelId: 'chan2', workspaceId: 'ws1' },
    channel: { id: 'chan2', name: 'bugs', workspaceId: 'ws1'},
    isRead: true, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
  },
];

export function NotificationPanel({
  isOpen,
  onClose,
  onNotificationClick,
  onMarkAsRead,
  onMarkAllAsRead,
  setUnreadCount
}: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications)
  const [isLoading, setIsLoading] = useState(true)
  // const { data: session } = useSession()

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    // Simulate API call
    // if (!session) { setIsLoading(false); return; }
    // try {
    //   const response = await fetch('/api/notifications?limit=10&status=all'); // Fetch all, including read
    //   const data = await response.json();
    //   if (data.notifications) {
    //     setNotifications(data.notifications);
    //     if (setUnreadCount && typeof data.totalUnread === 'number') {
    //        setUnreadCount(data.totalUnread);
    //     }
    //   }
    // } catch (error) {
    //   console.error('Failed to fetch notifications:', error);
    // }
    await new Promise(resolve => setTimeout(resolve, 300)); // Simulate delay
    setNotifications(mockNotifications.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    if (setUnreadCount) {
      setUnreadCount(mockNotifications.filter(n => !n.isRead).length);
    }
    setIsLoading(false);
  }, [/* session, */ setUnreadCount]);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead && onMarkAsRead) {
      try {
        await onMarkAsRead(notification.id);
        // Update local state if API call is successful
        setNotifications(prev => prev.map(n => n.id === notification.id ? {...n, isRead: true} : n));
        if (setUnreadCount) setUnreadCount(prev => Math.max(0, prev -1));
      } catch (error) {
        console.error("Failed to mark notification as read on click:", error);
      }
    }
    if (onNotificationClick) {
      onNotificationClick(notification);
    }
    onClose(); // Close panel after click
  };

  const handleMarkAllRead = async () => {
    if (onMarkAllAsRead) {
      try {
        await onMarkAllAsRead();
        setNotifications(prev => prev.map(n => ({...n, isRead: true})));
        if (setUnreadCount) setUnreadCount(0);
      } catch (error) {
        console.error("Failed to mark all notifications as read:", error);
      }
    }
  };

  if (!isOpen) return null;

  const getNotificationMessage = (notification: Notification) => {
    switch(notification.type) {
      case 'mention':
        return `${notification.sender.name || notification.sender.username} mentioned you in ${notification.channel ? `#${notification.channel.name}` : 'a message'}.`;
      case 'new_dm':
        return `${notification.sender.name || notification.sender.username} sent you a direct message.`;
      default:
        return `New notification from ${notification.sender.name || notification.sender.username}.`;
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-black bg-opacity-25"
      onClick={onClose} // Close on overlay click
    >
      <div
        className="absolute top-16 right-4 sm:right-8 md:right-12 w-full max-w-sm bg-white rounded-lg shadow-xl border border-slate-200 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside panel
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">Notifications</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100"
            aria-label="Close notifications"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto max-h-[calc(100vh-200px)]">
          {isLoading ? (
            <div className="p-6 text-center text-slate-500">Loading notifications...</div>
          ) : notifications.length === 0 ? (
            <div className="p-6 text-center text-slate-500">No notifications yet.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {notifications.map((notification) => (
                <li
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-4 hover:bg-slate-50 cursor-pointer ${notification.isRead ? 'opacity-70' : 'font-semibold'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 flex-shrink-0 w-2 h-2 rounded-full ${notification.isRead ? 'bg-slate-300' : 'bg-indigo-500'}`}></div>
                    <div className="flex-1">
                      <p className={`text-sm ${notification.isRead ? 'text-slate-600' : 'text-slate-800'}`}>
                        {getNotificationMessage(notification)}
                      </p>
                      <p className={`text-xs mt-1 ${notification.isRead ? 'text-slate-400' : 'text-slate-500'}`}>
                        {new Date(notification.createdAt).toLocaleString()}
                      </p>
                      {notification.message && (
                        <p className={`text-xs mt-1 italic truncate ${notification.isRead ? 'text-slate-500' : 'text-slate-600'}`}>
                          "{notification.message.content}"
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {notifications.some(n => !n.isRead) && (
          <div className="p-3 border-t border-slate-200 bg-slate-50">
            <button
              onClick={handleMarkAllRead}
              className="w-full text-sm text-indigo-600 hover:text-indigo-800 font-medium py-2 px-3 rounded-md hover:bg-indigo-50 transition-colors"
              disabled={isLoading || !onMarkAllAsRead}
            >
              Mark all as read
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
