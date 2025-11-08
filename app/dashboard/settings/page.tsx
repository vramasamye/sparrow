"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { DashboardNav } from "@/components/dashboard/dashboard-nav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Loader2, Save } from "lucide-react"

const AVAILABLE_TOPICS = [
  { id: "tech", label: "Technology", description: "General tech news and updates" },
  { id: "ai", label: "Artificial Intelligence", description: "AI and ML developments" },
  { id: "ml", label: "Machine Learning", description: "ML research and applications" },
  { id: "startups", label: "Startups", description: "Startup news and launches" },
  { id: "funding", label: "Funding", description: "Venture capital and funding rounds" },
  { id: "jobs", label: "Job Opportunities", description: "Tech job postings" },
  { id: "programming", label: "Programming", description: "Coding and development" },
  { id: "data-science", label: "Data Science", description: "Data analysis and insights" },
  { id: "product-launches", label: "Product Launches", description: "New product releases" },
  { id: "blockchain", label: "Blockchain", description: "Web3 and crypto" },
]

const FEED_FREQUENCIES = [
  { id: "realtime", label: "Real-time", description: "Get updates as they happen" },
  { id: "hourly", label: "Hourly", description: "Digest every hour" },
  { id: "daily", label: "Daily", description: "Once per day summary" },
]

interface Preferences {
  topics: string[]
  feedFrequency: string
  autoPostEnabled: boolean
  emailNotifications: boolean
}

export default function SettingsPage() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [preferences, setPreferences] = useState<Preferences>({
    topics: [],
    feedFrequency: "daily",
    autoPostEnabled: false,
    emailNotifications: true,
  })
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    fetchPreferences()
  }, [])

  const fetchPreferences = async () => {
    try {
      const response = await fetch("/api/preferences")
      if (response.ok) {
        const data = await response.json()
        setPreferences(data)
      }
    } catch (error) {
      console.error("Error fetching preferences:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to save preferences")
      }

      setMessage({ type: "success", text: "Preferences saved successfully!" })
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to save preferences" })
    } finally {
      setSaving(false)
    }
  }

  const toggleTopic = (topicId: string) => {
    setPreferences((prev) => ({
      ...prev,
      topics: prev.topics.includes(topicId)
        ? prev.topics.filter((t) => t !== topicId)
        : [...prev.topics, topicId],
    }))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardNav />
        <div className="container mx-auto px-4 py-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-gray-600">
            Manage your preferences and account settings
          </p>
        </div>

        <div className="space-y-6">
          {/* User Info */}
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>Your account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Name</Label>
                <p className="text-sm text-gray-600 mt-1">{session?.user?.name}</p>
              </div>
              <div>
                <Label>Email</Label>
                <p className="text-sm text-gray-600 mt-1">{session?.user?.email}</p>
              </div>
            </CardContent>
          </Card>

          {/* Topic Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Topic Preferences</CardTitle>
              <CardDescription>
                Select topics you're interested in for content curation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {AVAILABLE_TOPICS.map((topic) => (
                  <div
                    key={topic.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      preferences.topics.includes(topic.id)
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    onClick={() => toggleTopic(topic.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold">{topic.label}</h4>
                        <p className="text-xs text-gray-600 mt-1">
                          {topic.description}
                        </p>
                      </div>
                      {preferences.topics.includes(topic.id) && (
                        <Badge variant="default" className="ml-2">
                          Selected
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {preferences.topics.length === 0 && (
                <p className="text-sm text-red-600 mt-2">
                  Please select at least one topic
                </p>
              )}
            </CardContent>
          </Card>

          {/* Feed Frequency */}
          <Card>
            <CardHeader>
              <CardTitle>Feed Frequency</CardTitle>
              <CardDescription>
                How often do you want to receive content updates?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {FEED_FREQUENCIES.map((freq) => (
                  <div
                    key={freq.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      preferences.feedFrequency === freq.id
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    onClick={() =>
                      setPreferences((prev) => ({ ...prev, feedFrequency: freq.id }))
                    }
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">{freq.label}</h4>
                        <p className="text-xs text-gray-600 mt-1">{freq.description}</p>
                      </div>
                      {preferences.feedFrequency === freq.id && (
                        <Badge variant="default">Active</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>
                Manage your notification preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-posting</Label>
                  <p className="text-sm text-gray-600">
                    Automatically post generated drafts to social media
                  </p>
                </div>
                <Switch
                  checked={preferences.autoPostEnabled}
                  onCheckedChange={(checked) =>
                    setPreferences((prev) => ({ ...prev, autoPostEnabled: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email notifications</Label>
                  <p className="text-sm text-gray-600">
                    Receive email updates about new content
                  </p>
                </div>
                <Switch
                  checked={preferences.emailNotifications}
                  onCheckedChange={(checked) =>
                    setPreferences((prev) => ({ ...prev, emailNotifications: checked }))
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          {message && (
            <div
              className={`p-4 rounded-md ${
                message.type === "success"
                  ? "bg-green-50 text-green-600"
                  : "bg-red-50 text-red-600"
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving || preferences.topics.length === 0}
              size="lg"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Preferences
                </>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
