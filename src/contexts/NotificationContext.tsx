'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useSocket } from '@/hooks/useSocket'; // Assuming useSocket is set up

// Define the structure of a Notification object as expected from the API/socket
// This should align with backend's Notification model + included relations
interface ApiNotification {
  id: string;
  userId: string; // Recipient
  type: 'mention' | 'new_dm' | string; // 'mention', 'new_dm', etc.
  messageId?: string | null;
  message?: { // Optional, but useful for context
    id: string;
    content: string; // Snippet or full
    channelId?: string | null;
    recipientId?: string | null; // Original recipient of the DM message
    senderId?: string; // Original sender of the DM message (if message.user is not populated)
    mentionedUserIds?: string | null; // Comma-separated string
  } | null;
  channelId?: string | null;
  channel?: { // Optional, for context
    id: string;
    name: string;
    workspaceId: string;
  } | null;
  senderId: string; // User who triggered the notification
  sender?: { // User who triggered the notification
    id: string;
    username: string;
    name?: string | null;
  };
  isRead: boolean;
  createdAt: string;
}

interface UnreadCounts {
  [key: string]: { count: number; hasMention: boolean }; // key can be channelId or dmPartnerId
}

interface NotificationContextType {
  unreadNotifications: ApiNotification[];
  unreadCounts: UnreadCounts; // Aggregated counts for channels/DMs
  totalUnreadMentions: number;
  totalUnreadDms: number;
  refreshUnreadNotifications: () => void; // Function to manually refetch
  markNotificationsAsReadForContext: (contextId: string, type: 'channel' | 'dm') => void; // To update counts locally
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotificationContext = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps { // Renamed from PresenceProviderProps
  children: ReactNode;
}

export const NotificationProvider = ({ children }: NotificationProviderProps) => { // Renamed from PresenceProvider
  const { data: session, status: sessionStatus } = useSession();
  const { onNewNotification, isConnected } = useSocket();
  const [unreadNotifications, setUnreadNotifications] = useState<ApiNotification[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({});
  const [totalUnreadMentions, setTotalUnreadMentions] = useState(0);
  const [totalUnreadDms, setTotalUnreadDms] = useState(0);

  const aggregateCounts = useCallback((notifications: ApiNotification[]): UnreadCounts => {
    const counts: UnreadCounts = {};
    let mentionCount = 0;
    let dmCount = 0;

    notifications.forEach(notif => {
      if (notif.isRead) return;

      if (notif.type === 'mention' && notif.channelId) {
        const key = `channel_${notif.channelId}`;
        counts[key] = counts[key] || { count: 0, hasMention: false };
        counts[key].count++;
        counts[key].hasMention = true;
        mentionCount++;
      } else if (notif.type === 'new_dm') {
        // For DMs, the context is the senderId (the other person in DM)
        const key = `dm_${notif.senderId}`;
        counts[key] = counts[key] || { count: 0, hasMention: false }; // DMs typically don't have "mentions" in the same way
        counts[key].count++;
        dmCount++;
      }
      // Could add handling for other notification types if they contribute to channel/DM unread counts
    });
    setTotalUnreadMentions(mentionCount);
    setTotalUnreadDms(dmCount);
    return counts;
  }, []);

  const fetchUnreadNotifications = useCallback(async () => {
    if (sessionStatus !== 'authenticated' || !session?.accessToken) {
      setUnreadNotifications([]); // Clear if not authenticated
      return;
    }
    try {
      const token = localStorage.getItem('token') || session.accessToken;
      const response = await fetch(`/api/notifications?status=unread&limit=100`, { // Fetch up to 100 unread
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        console.error('Failed to fetch unread notifications');
        setUnreadNotifications([]);
        return;
      }
      const data = await response.json(); // Expects { notifications: ApiNotification[] }
      const fetchedNotifications = data.notifications || [];
      setUnreadNotifications(fetchedNotifications);
      setUnreadCounts(aggregateCounts(fetchedNotifications));
    } catch (error) {
      console.error('Error fetching unread notifications:', error);
      setUnreadNotifications([]);
    }
  }, [session, sessionStatus, aggregateCounts]);

  useEffect(() => {
    fetchUnreadNotifications();
  }, [fetchUnreadNotifications]);

  // Handle new notifications from socket
  useEffect(() => {
    if (!isConnected || !onNewNotification) return;

    const cleanup = onNewNotification((newNotif: ApiNotification) => {
      // Add to list and re-aggregate
      setUnreadNotifications(prev => {
        // Avoid duplicates if already received
        if (prev.find(n => n.id === newNotif.id)) return prev;
        const updated = [...prev, newNotif];
        setUnreadCounts(aggregateCounts(updated));
        return updated;
      });
    });
    return cleanup;
  }, [isConnected, onNewNotification, aggregateCounts]);

  // Function to mark notifications as read for a given context (channel or DM)
  // This is a client-side optimistic update of counts.
  // Actual marking read happens via API calls elsewhere (e.g., when opening channel/DM or NotificationPanel)
  const markNotificationsAsReadForContext = useCallback((contextId: string, type: 'channel' | 'dm') => {
    setUnreadNotifications(prev => {
      const updated = prev.map(n => {
        if (type === 'channel' && n.channelId === contextId && !n.isRead) {
          return { ...n, isRead: true };
        }
        if (type === 'dm' && n.type === 'new_dm' && n.senderId === contextId && !n.isRead) {
          return { ...n, isRead: true };
        }
        return n;
      }).filter(n => !n.isRead); // Keep only unread ones for the main list

      setUnreadCounts(aggregateCounts(updated)); // Re-aggregate based on remaining unread
      return updated;
    });
  }, [aggregateCounts]);

  return (
    <NotificationContext.Provider value={{
      unreadNotifications,
      unreadCounts,
      totalUnreadMentions,
      totalUnreadDms,
      refreshUnreadNotifications: fetchUnreadNotifications,
      markNotificationsAsReadForContext
    }}>
      {children}
    </NotificationContext.Provider>
  );
};
