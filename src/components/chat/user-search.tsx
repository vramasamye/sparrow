'use client'

import { useState, useEffect } from 'react'

interface User {
  id: string
  username: string
  name?: string
  email: string
  avatar?: string
}

interface UserSearchProps {
  onClose: () => void
  onUserSelect?: (user: User) => void
  workspaceId?: string; // Optional: to filter search by workspace
}

export function UserSearch({ onClose, onUserSelect, workspaceId }: UserSearchProps) {
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const searchUsers = async () => {
      if (query.length < 2) {
        setUsers([])
        return
      }

      setLoading(true)
      try {
        let apiUrl = `/api/users/search?q=${encodeURIComponent(query)}`;
        if (workspaceId) {
          apiUrl += `&workspaceId=${workspaceId}`;
        }
        const response = await fetch(apiUrl);
        const data = await response.json()
        
        if (data.users) {
          setUsers(data.users)
        }
      } catch (error) {
        console.error('Search failed:', error)
      } finally {
        setLoading(false)
      }
    }

    const debounceTimer = setTimeout(searchUsers, 300)
    return () => clearTimeout(debounceTimer)
  }, [query])

  const handleUserClick = (user: User) => {
    if (onUserSelect) {
      onUserSelect(user)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md max-h-96 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Find Users</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="mt-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, username, or email..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="p-4 text-center text-gray-500">
              Searching...
            </div>
          )}
          
          {!loading && query.length >= 2 && users.length === 0 && (
            <div className="p-4 text-center text-gray-500">
              No users found
            </div>
          )}
          
          {!loading && query.length < 2 && (
            <div className="p-4 text-center text-gray-500">
              Type at least 2 characters to search
            </div>
          )}

          {!loading && users.length > 0 && (
            <div className="p-2">
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleUserClick(user)}
                  className="w-full text-left p-3 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {user.name?.[0] || user.username[0]}
                      </span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900">
                        {user.name || user.username}
                      </div>
                      <div className="text-sm text-gray-500 truncate">
                        @{user.username} • {user.email}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      <span className="text-xs text-gray-500">Online</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}