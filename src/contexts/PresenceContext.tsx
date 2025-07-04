'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useSession } from 'next-auth/react';

interface UserPresence {
  isOnline: boolean;
  customStatusText?: string | null;
  customStatusEmoji?: string | null;
  lastSeenAt?: string | null; // ISO string
}

type PresenceMap = Map<string, UserPresence>; // userId -> UserPresence

interface PresenceContextType {
  presences: PresenceMap;
  // Function to manually update a user's presence if needed, though mostly socket-driven
  // updateUserPresence: (userId: string, updates: Partial<UserPresence>) => void;
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

export const usePresence = (): PresenceContextType => {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error('usePresence must be used within a PresenceProvider');
  }
  return context;
};

interface PresenceProviderProps {
  children: ReactNode;
  workspaceId?: string | null; // Current active workspace ID
}

export const PresenceProvider = ({ children, workspaceId }: PresenceProviderProps) => {
  const [presences, setPresences] = useState<PresenceMap>(new Map());
  const {
    isConnected,
    onUserStatusChange, // for online/offline
    onUserStatusUpdated,  // for custom status text/emoji changes
    onWorkspacePresenceState // for initial dump of presence in a workspace
  } = useSocket();
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;

  // Handler for initial presence state when joining/switching workspaces
  useEffect(() => {
    if (!isConnected || !workspaceId || !onWorkspacePresenceState) return;

    const cleanup = onWorkspacePresenceState((data) => {
      if (data.workspaceId === workspaceId) {
        setPresences(prevPresences => {
          const newPresences = new Map(prevPresences);
          data.users.forEach((user: any) => { // user type from backend: { userId, username, name, isOnline, customStatusText, customStatusEmoji, lastSeenAt }
            newPresences.set(user.userId, {
              isOnline: user.isOnline,
              customStatusText: user.customStatusText,
              customStatusEmoji: user.customStatusEmoji,
              lastSeenAt: user.lastSeenAt,
            });
          });
          // Ensure current user is marked as online if connected
          if (currentUserId) {
            const currentUserData = newPresences.get(currentUserId) || {};
            newPresences.set(currentUserId, { ...currentUserData, isOnline: true });
          }
          return newPresences;
        });
      }
    });
    return cleanup;
  }, [isConnected, workspaceId, onWorkspacePresenceState, currentUserId]);

  // Handler for individual user online/offline status changes
  useEffect(() => {
    if (!isConnected || !onUserStatusChange) return;

    const cleanup = onUserStatusChange((data) => { // data: { userId, status: 'online'|'offline', username?, name?, customStatusText?, customStatusEmoji? }
      setPresences(prevPresences => {
        const newPresences = new Map(prevPresences);
        const existing = newPresences.get(data.userId) || {};
        newPresences.set(data.userId, {
          ...existing,
          isOnline: data.status === 'online',
          lastSeenAt: data.status === 'offline' ? new Date().toISOString() : existing.lastSeenAt, // Update lastSeenAt on going offline
           // If user_online event includes custom status, update it here too
          customStatusText: data.status === 'online' ? (data.customStatusText ?? existing.customStatusText) : existing.customStatusText,
          customStatusEmoji: data.status === 'online' ? (data.customStatusEmoji ?? existing.customStatusEmoji) : existing.customStatusEmoji,
        });
        return newPresences;
      });
    });
    return cleanup;
  }, [isConnected, onUserStatusChange]);

  // Handler for custom status message updates
  useEffect(() => {
    if (!isConnected || !onUserStatusUpdated) return;

    const cleanup = onUserStatusUpdated((data) => { // data: { userId, customStatusText, customStatusEmoji }
      setPresences(prevPresences => {
        const newPresences = new Map(prevPresences);
        const existing = newPresences.get(data.userId) || { isOnline: false }; // Assume offline if not seen before
        newPresences.set(data.userId, {
          ...existing,
          customStatusText: data.customStatusText,
          customStatusEmoji: data.customStatusEmoji,
        });
        return newPresences;
      });
    });
    return cleanup;
  }, [isConnected, onUserStatusUpdated]);


  // Clear presences when workspace changes to avoid stale data from previous workspace
  useEffect(() => {
    setPresences(new Map());
    // When workspaceId changes, the onWorkspacePresenceState effect will trigger and repopulate.
  }, [workspaceId]);


  return (
    <PresenceContext.Provider value={{ presences }}>
      {children}
    </PresenceContext.Provider>
  );
};
