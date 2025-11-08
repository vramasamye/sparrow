"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { DashboardNav } from "@/components/dashboard/dashboard-nav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { formatDateTime } from "@/lib/utils"
import { Loader2, Edit, Trash2, Calendar, Send, Sparkles } from "lucide-react"

interface Draft {
  id: string
  title: string
  body: string
  platform: string
  status: string
  isAIGenerated: boolean
  scheduledFor: Date | null
  createdAt: Date
  content: {
    title: string
    url: string
  } | null
}

const PLATFORMS = [
  { id: "twitter", label: "Twitter", color: "bg-blue-400" },
  { id: "linkedin", label: "LinkedIn", color: "bg-blue-600" },
  { id: "facebook", label: "Facebook", color: "bg-blue-700" },
]

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-500",
  scheduled: "bg-yellow-500",
  published: "bg-green-500",
  failed: "bg-red-500",
}

export default function DraftsPage() {
  const { data: session } = useSession()
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editedBody, setEditedBody] = useState("")

  useEffect(() => {
    fetchDrafts()
  }, [])

  const fetchDrafts = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/drafts")
      if (response.ok) {
        const data = await response.json()
        setDrafts(data || [])
      }
    } catch (error) {
      console.error("Error fetching drafts:", error)
    } finally {
      setLoading(false)
    }
  }

  const startEditing = (draft: Draft) => {
    setEditingId(draft.id)
    setEditedBody(draft.body)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditedBody("")
  }

  const saveDraft = async (id: string) => {
    try {
      const response = await fetch(`/api/drafts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: editedBody }),
      })

      if (response.ok) {
        await fetchDrafts()
        setEditingId(null)
        setEditedBody("")
      } else {
        alert("Failed to save draft")
      }
    } catch (error) {
      console.error("Error saving draft:", error)
      alert("Failed to save draft")
    }
  }

  const deleteDraft = async (id: string) => {
    if (!confirm("Are you sure you want to delete this draft?")) return

    try {
      const response = await fetch(`/api/drafts/${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        await fetchDrafts()
      } else {
        alert("Failed to delete draft")
      }
    } catch (error) {
      console.error("Error deleting draft:", error)
      alert("Failed to delete draft")
    }
  }

  const getPlatformInfo = (platform: string) => {
    return PLATFORMS.find((p) => p.id === platform) || PLATFORMS[0]
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Drafts</h1>
          <p className="text-gray-600">
            Manage your AI-generated and custom drafts
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : drafts.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No drafts yet</h3>
              <p className="text-gray-600 mb-4">
                Generate your first draft from the Content page
              </p>
              <Button onClick={() => (window.location.href = "/dashboard/content")}>
                Browse Content
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {drafts.map((draft) => {
              const platform = getPlatformInfo(draft.platform)
              const isEditing = editingId === draft.id

              return (
                <Card key={draft.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${platform.color}`} />
                          {platform.label}
                          {draft.isAIGenerated && (
                            <Sparkles className="h-4 w-4 text-blue-600" />
                          )}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {draft.content ? (
                            <span className="text-xs">{draft.content.title}</span>
                          ) : (
                            <span className="text-xs">Custom draft</span>
                          )}
                        </CardDescription>
                      </div>
                      <Badge className={STATUS_COLORS[draft.status] || "bg-gray-500"}>
                        {draft.status}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Draft Body */}
                    {isEditing ? (
                      <div>
                        <Label>Edit Draft</Label>
                        <textarea
                          value={editedBody}
                          onChange={(e) => setEditedBody(e.target.value)}
                          className="w-full min-h-[150px] p-3 border rounded-md mt-1 text-sm"
                          placeholder="Write your post..."
                        />
                        <div className="flex justify-end space-x-2 mt-2">
                          <Button variant="outline" size="sm" onClick={cancelEditing}>
                            Cancel
                          </Button>
                          <Button size="sm" onClick={() => saveDraft(draft.id)}>
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 p-4 rounded-md">
                        <p className="text-sm whitespace-pre-wrap">{draft.body}</p>
                        <div className="text-xs text-gray-500 mt-2">
                          {draft.body.length} characters
                        </div>
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
                      <div className="space-y-1">
                        <div>Created: {formatDateTime(draft.createdAt)}</div>
                        {draft.scheduledFor && (
                          <div className="flex items-center text-yellow-600">
                            <Calendar className="h-3 w-3 mr-1" />
                            Scheduled: {formatDateTime(draft.scheduledFor)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    {!isEditing && (
                      <div className="flex items-center space-x-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEditing(draft)}
                          className="flex-1"
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteDraft(draft.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>

                        <Button
                          size="sm"
                          disabled={draft.status !== "draft"}
                          className="flex-1"
                        >
                          <Send className="h-4 w-4 mr-1" />
                          Publish
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Summary */}
        {!loading && drafts.length > 0 && (
          <Card className="mt-6">
            <CardContent className="pt-6">
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {drafts.length}
                  </div>
                  <div className="text-xs text-gray-600">Total Drafts</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-600">
                    {drafts.filter((d) => d.status === "draft").length}
                  </div>
                  <div className="text-xs text-gray-600">In Draft</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-600">
                    {drafts.filter((d) => d.status === "scheduled").length}
                  </div>
                  <div className="text-xs text-gray-600">Scheduled</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {drafts.filter((d) => d.status === "published").length}
                  </div>
                  <div className="text-xs text-gray-600">Published</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}

function FileText({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}
