'use client'

import { useState, useEffect } from 'react'
// import { useSocket } from '@/hooks/useSocket' // Will be used later
// import { useSession } from 'next-auth/react' // If needed for API calls

interface NotificationBellProps {
  onClick?: () => void;
  initialUnreadCount: number;
  setUnreadCount: (count: number | ((prev: number) => number)) => void; // Allow functional updates
}

export function NotificationBell({ onClick, initialUnreadCount, setUnreadCount }: NotificationBellProps) {
  // Unread count is now managed by parent (ChatInterface)
  // isLoading can be local if desired, or also passed if fetch happens in parent
  const [isLoading, setIsLoading] = useState(false) // Assuming parent handles initial load state

  // const { data: session } = useSession() // If needed for direct API calls from Bell
  // const { onNewNotification } // from useSocket, if socket logic is handled here

  // Parent (ChatInterface) will fetch and pass initialUnreadCount.
  // Parent will also listen to socket and call setUnreadCount.

  // TODO: Listen for new_notification socket event to update count
  // useEffect(() => {
  //   const cleanup = onNewNotification((notification) => {
  //     setUnreadCount(prev => prev + 1)
  //     // Potentially show a browser notification here too
  //   });
  //   return cleanup;
  // }, [onNewNotification]);

  const handleClick = () => {
    if (onClick) {
      onClick()
    }
    // Potentially mark some notifications as read or change state
  }

  return (
    <button
      onClick={handleClick}
      className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
      aria-label={`Notifications (${initialUnreadCount} unread)`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>
      {isLoading ? ( // This isLoading is now local to NotificationBell, can be removed if parent manages all loading states
        <span className="absolute top-0 right-0 block h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-300 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-400"></span>
        </span>
      ) : initialUnreadCount > 0 && (
        <span className="absolute top-0.5 right-0.5 block h-4 w-4 transform translate-x-1/3 -translate-y-1/3">
          <span className="absolute inline-flex items-center justify-center w-full h-full text-[10px] font-bold text-white bg-red-500 border border-white rounded-full">
            {initialUnreadCount > 9 ? '9+' : initialUnreadCount}
          </span>
        </span>
      )}
    </button>
  )
}
