'use client'

import { ReactNode } from 'react'

interface SocketProviderInnerProps {
  children: ReactNode
}

export function SocketProviderInner({ children }: SocketProviderInnerProps) {
  return <>{children}</>
}