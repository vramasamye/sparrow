export interface User {
  id: string
  email: string
  username: string
  name?: string
  avatar?: string
  isOnline: boolean
  lastSeen: Date
}

export interface Workspace {
  id: string
  name: string
  description?: string
  ownerId: string
  createdAt: Date
  updatedAt: Date
}

export interface Channel {
  id: string
  name: string
  description?: string
  isPrivate: boolean
  workspaceId: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface Message {
  id: string
  content: string
  userId: string
  channelId?: string
  workspaceId?: string
  recipientId?: string
  createdAt: Date
  updatedAt: Date
  user: {
    id: string
    username: string
    name?: string
    avatar?: string
  }
}

export interface AuthenticatedRequest extends Express.Request {
  user?: {
    id: string
    email: string
    username: string
    name?: string
  }
}

export interface SocketUser {
  id: string
  username: string
  name?: string
  workspaceId: string
  socketId: string
  isOnline: boolean
}

export interface TypingData {
  userId: string
  username: string
  channelId: string
}

export interface MessageData {
  id: string
  content: string
  userId: string
  channelId?: string
  recipientId?: string
  workspaceId?: string
  createdAt: string
  user: {
    id: string
    username: string
    name?: string
    avatar?: string
  }
}