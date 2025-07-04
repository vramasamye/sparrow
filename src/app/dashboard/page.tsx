'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ChatInterface } from '@/components/chat/chat-interface'
import { CreateWorkspaceModal } from '@/components/workspace/create-workspace-modal'
import { NotificationProvider } from '@/contexts/NotificationContext' // Import NotificationProvider

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [workspaces, setWorkspaces] = useState([])
  const [currentWorkspace, setCurrentWorkspace] = useState(null)
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/signin')
      return
    }
    loadWorkspaces()
  }, [session, status, router])

  const loadWorkspaces = async () => {
    try {
      const response = await fetch('/api/workspaces')
      const data = await response.json()
      
      if (data.workspaces) {
        setWorkspaces(data.workspaces)
        if (data.workspaces.length > 0 && !currentWorkspace) {
          setCurrentWorkspace(data.workspaces[0])
        }
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error)
    } finally {
      setLoading(false)
    }
  }

  const refreshWorkspaces = () => {
    // Optionally, could try to be smarter and only refetch the currentWorkspace if its ID is known
    // and if the invite was for the currentWorkspace.
    // For now, a full reload of all workspaces is simpler.
    setLoading(true); // Show loading indicator during refresh
    loadWorkspaces();
  }

  const handleWorkspaceCreated = (workspace: any) => {
    // When a new workspace is created, it's added to the list and set as current.
    // No need to call refreshWorkspaces which reloads all.
    setWorkspaces(prev => [...prev, workspace])
    setCurrentWorkspace(workspace)
    setShowCreateWorkspace(false)
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  if (workspaces.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Welcome to Team Messenger!
          </h2>
          <p className="text-gray-600 mb-6">
            Create your first workspace to start messaging
          </p>
          <button
            onClick={() => setShowCreateWorkspace(true)}
            className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700"
          >
            Create Workspace
          </button>
        </div>
        
        {showCreateWorkspace && (
          <CreateWorkspaceModal
            onClose={() => setShowCreateWorkspace(false)}
            onWorkspaceCreated={handleWorkspaceCreated}
          />
        )}
      </div>
    )
  }

  return (
    <NotificationProvider> {/* Wrap with NotificationProvider */}
      <div className="h-screen flex bg-gray-100 dark:bg-slate-950"> {/* Added dark bg for consistency */}
        <ChatInterface
          workspace={currentWorkspace}
          workspaces={workspaces}
          onWorkspaceChange={setCurrentWorkspace}
          onCreateWorkspace={() => setShowCreateWorkspace(true)}
          onRefreshWorkspaces={refreshWorkspaces}
        />

        {showCreateWorkspace && (
        <CreateWorkspaceModal
          onClose={() => setShowCreateWorkspace(false)}
          onWorkspaceCreated={handleWorkspaceCreated}
        />
      )}
    </div>
  )
}