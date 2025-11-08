"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { DashboardNav } from "@/components/dashboard/dashboard-nav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Loader2, Save, Plus, Trash2, Twitter, Linkedin, Facebook, Check } from "lucide-react"

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

const PLATFORMS = [
  { id: "twitter", label: "Twitter", icon: Twitter, color: "bg-blue-400" },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin, color: "bg-blue-600" },
  { id: "facebook", label: "Facebook", icon: Facebook, color: "bg-blue-700" },
]

interface Preferences {
  topics: string[]
  feedFrequency: string
  autoPostEnabled: boolean
  emailNotifications: boolean
  selectedPlatforms: string[]
  postsPerPlatform: number
}

interface SocialAccount {
  id: string
  platform: string
  accountName: string
  isActive: boolean
  createdAt: Date
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
    selectedPlatforms: [],
    postsPerPlatform: 6,
  })
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([])
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [newAccount, setNewAccount] = useState({ platform: "twitter", accountName: "" })
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    fetchPreferences()
    fetchSocialAccounts()
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

  const fetchSocialAccounts = async () => {
    try {
      const response = await fetch("/api/social-accounts")
      if (response.ok) {
        const data = await response.json()
        setSocialAccounts(data)
      }
    } catch (error) {
      console.error("Error fetching social accounts:", error)
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

  const togglePlatform = (platformId: string) => {
    setPreferences((prev) => ({
      ...prev,
      selectedPlatforms: prev.selectedPlatforms.includes(platformId)
        ? prev.selectedPlatforms.filter((p) => p !== platformId)
        : [...prev.selectedPlatforms, platformId],
    }))
  }

  const addSocialAccount = async () => {
    if (!newAccount.accountName) {
      setMessage({ type: "error", text: "Account name is required" })
      return
    }

    try {
      const response = await fetch("/api/social-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAccount),
      })

      if (!response.ok) {
        throw new Error("Failed to add account")
      }

      await fetchSocialAccounts()
      setShowAddAccount(false)
      setNewAccount({ platform: "twitter", accountName: "" })
      setMessage({ type: "success", text: "Social account connected!" })
    } catch (error: any) {
      setMessage({ type: "error", text: error.message })
    }
  }

  const deleteSocialAccount = async (id: string) => {
    if (!confirm("Are you sure you want to disconnect this account?")) return

    try {
      const response = await fetch(`/api/social-accounts?id=${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete account")
      }

      await fetchSocialAccounts()
      setMessage({ type: "success", text: "Account disconnected" })
    } catch (error: any) {
      setMessage({ type: "error", text: error.message })
    }
  }

  const getPlatformInfo = (platformId: string) => {
    return PLATFORMS.find((p) => p.id === platformId)!
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
            Manage your preferences and social accounts
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

          {/* Social Accounts */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Connected Social Accounts</CardTitle>
                  <CardDescription>
                    Connect your social media accounts for auto-posting
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddAccount(!showAddAccount)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Account
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {showAddAccount && (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h4 className="font-semibold mb-3">Connect New Account</h4>
                  <div className="space-y-3">
                    <div>
                      <Label>Platform</Label>
                      <select
                        className="w-full mt-1 p-2 border rounded-md"
                        value={newAccount.platform}
                        onChange={(e) =>
                          setNewAccount({ ...newAccount, platform: e.target.value })
                        }
                      >
                        {PLATFORMS.map((platform) => (
                          <option key={platform.id} value={platform.id}>
                            {platform.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Account Name/Username</Label>
                      <Input
                        placeholder="@username"
                        value={newAccount.accountName}
                        onChange={(e) =>
                          setNewAccount({ ...newAccount, accountName: e.target.value })
                        }
                      />
                    </div>
                    <div className="flex space-x-2">
                      <Button onClick={addSocialAccount} className="flex-1">
                        Connect
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowAddAccount(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {socialAccounts.length === 0 ? (
                <p className="text-sm text-gray-600">
                  No social accounts connected yet. Add one to enable auto-posting.
                </p>
              ) : (
                <div className="space-y-2">
                  {socialAccounts.map((account) => {
                    const platform = getPlatformInfo(account.platform)
                    const Icon = platform.icon
                    return (
                      <div
                        key={account.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg ${platform.color} text-white`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium">{account.accountName}</p>
                            <p className="text-xs text-gray-500">{platform.label}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {account.isActive && (
                            <Badge variant="outline" className="text-green-600">
                              <Check className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteSocialAccount(account.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Auto-Posting Platforms */}
          <Card>
            <CardHeader>
              <CardTitle>Auto-Posting Platforms</CardTitle>
              <CardDescription>
                Select platforms where you want to auto-post content (6 posts per platform)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {PLATFORMS.map((platform) => {
                  const Icon = platform.icon
                  const isConnected = socialAccounts.some(
                    (acc) => acc.platform === platform.id && acc.isActive
                  )
                  const isSelected = preferences.selectedPlatforms.includes(platform.id)

                  return (
                    <div
                      key={platform.id}
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                        isSelected
                          ? "border-blue-600 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      } ${!isConnected ? "opacity-50" : ""}`}
                      onClick={() => isConnected && togglePlatform(platform.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg ${platform.color} text-white`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="font-semibold">{platform.label}</h4>
                            <p className="text-xs text-gray-600">
                              {isConnected
                                ? "Account connected - Click to enable auto-posting"
                                : "Connect account first to enable"}
                            </p>
                          </div>
                        </div>
                        {isSelected && (
                          <Badge variant="default">Auto-posting enabled</Badge>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Topic Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Topic Preferences</CardTitle>
              <CardDescription>
                Select topics for content curation and auto-posting
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
                How often to fetch content from your feeds
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
              <CardTitle>Notifications & Automation</CardTitle>
              <CardDescription>
                Manage your notification and automation preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-posting</Label>
                  <p className="text-sm text-gray-600">
                    Automatically post 6 unique pieces of content per platform based on your topics
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
                    Receive email updates about posted content
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
