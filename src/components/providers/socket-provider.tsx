'use client'

import dynamic from 'next/dynamic'
import { createContext, useContext, ReactNode } from 'react'

// Create a context for socket
const SocketContext = createContext<any>(null)

// Dynamic import of the socket hook to avoid SSR issues
const SocketProviderInner = dynamic(
  () => import('./socket-provider-inner').then(mod => mod.SocketProviderInner),
  { 
    ssr: false,
    loading: () => <div>Connecting...</div>
  }
)

interface SocketProviderProps {
  children: ReactNode
}

export function SocketProvider({ children }: SocketProviderProps) {
  return (
    <SocketContext.Provider value={null}>
      <SocketProviderInner>
        {children}
      </SocketProviderInner>
    </SocketContext.Provider>
  )
}

export const useSocketContext = () => useContext(SocketContext)