'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export function useSocket() {
  const [socket, setSocket] = useState<any>(null)
  const [isConnected, setIsConnected] = useState(false)
  const { data: session, status } = useSession()

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user) return
    if (typeof window === 'undefined') return

    // console.log('Attempting to connect socket...', { user: session.user })

    let socketInstance: any = null

    const initSocket = async () => {
      try {
        // Import socket.io-client dynamically
        const socketIO = await import('socket.io-client')
        const io = socketIO.io || socketIO.default

        // Use the real JWT token from backend
        const realToken = session.accessToken || `mock-${session.user.email}-${Date.now()}`

        // Prepare user data with all available fields
        const userData = {
          email: session.user.email,
          name: session.user.name,
          username: session.user.username || session.user.name || session.user.email?.split('@')[0],
          id: session.user.id
        }

        // console.log('Connecting with user data:', userData, 'Token:', realToken?.substring(0, 20))

        socketInstance = io(BACKEND_URL, {
          auth: {
            token: realToken,
            user: userData
          },
          transports: ['websocket', 'polling'],
          timeout: 10000,
          forceNew: true
        })

        socketInstance.on('connect', () => {
          // console.log('Socket connected successfully')
          setIsConnected(true)
        })

        socketInstance.on('disconnect', (reason: any) => {
          // console.log('Socket disconnected:', reason)
          setIsConnected(false)
        })

        socketInstance.on('connect_error', (error: any) => {
          console.error('Socket connection error:', error) // Keep important errors
          setIsConnected(false)
        })

        socketInstance.on('error', (error: any) => {
          console.error('Socket error:', error) // Keep important errors
        })

        setSocket(socketInstance)
      } catch (error) {
        console.error('Failed to initialize socket:', error) // Keep important errors
      }
    }

    initSocket()

    return () => {
      if (socketInstance && socketInstance.disconnect) {
        // console.log('Cleaning up socket connection')
        socketInstance.disconnect()
      }
    }
  }, [session, status])

  const joinWorkspace = useCallback((workspaceId: string) => {
    if (socket && isConnected && socket.emit) {
      // console.log('Joining workspace:', workspaceId)
      socket.emit('join_workspace', workspaceId)
    }
  }, [socket, isConnected])

  const joinChannel = useCallback((channelId: string) => {
    if (socket && isConnected && socket.emit) {
      // console.log('Joining channel:', channelId)
      socket.emit('join_channel', channelId)
    }
  }, [socket, isConnected])

  const leaveChannel = useCallback((channelId: string, workspaceId: string) => {
    if (socket && isConnected && socket.emit) {
      socket.emit('leave_channel', { channelId, workspaceId })
    }
  }, [socket, isConnected])

  const sendMessage = useCallback((channelId: string, content: string) => {
    if (socket && isConnected && socket.emit) {
      // console.log('Sending message via socket:', { channelId, content })
      socket.emit('send_message', { channelId, content })
    }
  }, [socket, isConnected])

  const sendDirectMessage = useCallback((recipientId: string, content: string) => {
    if (socket && isConnected && socket.emit) {
      socket.emit('send_message', { recipientId, content })
    }
  }, [socket, isConnected])

  const startTyping = useCallback((channelId: string) => {
    if (socket && isConnected && socket.emit) {
      socket.emit('start_typing', { channelId })
    }
  }, [socket, isConnected])

  const stopTyping = useCallback((channelId: string) => {
    if (socket && isConnected && socket.emit) {
      socket.emit('stop_typing', { channelId })
    }
  }, [socket, isConnected])

  const onNewMessage = useCallback((callback: (message: any) => void) => {
    if (!socket || !socket.on) return () => {}

    socket.on('new_message', callback)
    return () => socket.off && socket.off('new_message', callback)
  }, [socket])

  const onNewDirectMessage = useCallback((callback: (message: any) => void) => {
    if (!socket || !socket.on) return () => {}

    socket.on('new_direct_message', callback)
    return () => socket.off && socket.off('new_direct_message', callback)
  }, [socket])

  const onUserTyping = useCallback((callback: (data: { userId: string; username: string; channelId: string }) => void) => {
    if (!socket || !socket.on) return () => {}

    socket.on('user_typing', callback)
    return () => socket.off && socket.off('user_typing', callback)
  }, [socket])

  const onUserStopTyping = useCallback((callback: (data: { userId: string; channelId: string }) => void) => {
    if (!socket || !socket.on) return () => {}

    socket.on('user_stop_typing', callback)
    return () => socket.off && socket.off('user_stop_typing', callback)
  }, [socket])

  const onUserStatusChange = useCallback((callback: (data: { userId: string; status: string }) => void) => {
    if (!socket || !socket.on) return () => {}

    socket.on('user_online', (data: any) => callback({ ...data, status: 'online' }))
    socket.on('user_offline', (data: any) => callback({ ...data, status: 'offline' }))
    
    return () => {
      if (socket.off) {
        socket.off('user_online')
        socket.off('user_offline')
      }
    }
  }, [socket])

  return {
    socket,
    isConnected,
    joinWorkspace,
    joinChannel,
    leaveChannel,
    sendMessage,
    sendDirectMessage,
    startTyping,
    stopTyping,
    onNewMessage,
    onNewDirectMessage,
    onUserTyping,
    onUserStopTyping,
    onUserStatusChange,

    // For message updates/deletes
    onMessageUpdated: useCallback((callback: (message: any) => void) => {
      if (!socket || !socket.on) return () => {};
      socket.on('message_updated', callback);
      return () => socket.off && socket.off('message_updated', callback);
    }, [socket]),

    onMessageDeleted: useCallback((callback: (data: { id: string; channelId?: string; recipientId?: string; userId?: string; }) => void) => {
      if (!socket || !socket.on) return () => {};
      socket.on('message_deleted', callback);
      return () => socket.off && socket.off('message_deleted', callback);
    }, [socket]),

    // For channel join/leave
    onUserJoinedChannel: useCallback((callback: (data: any) => void) => {
      if (!socket || !socket.on) return () => {};
      socket.on('user_joined_channel', callback);
      return () => socket.off && socket.off('user_joined_channel', callback);
    }, [socket]),

    onUserLeftChannel: useCallback((callback: (data: any) => void) => {
      if (!socket || !socket.on) return () => {};
      socket.on('user_left_channel', callback);
      return () => socket.off && socket.off('user_left_channel', callback);
    }, [socket]),

    // For notifications (already added in previous step, ensure it's here)
    onNewNotification: useCallback((callback: (notification: any) => void) => {
      if (!socket || !socket.on) return () => {};
      socket.on('new_notification', callback);
      return () => socket.off && socket.off('new_notification', callback);
    }, [socket]),

  }
}