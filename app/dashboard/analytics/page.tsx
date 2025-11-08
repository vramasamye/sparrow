"use client"

import { useState, useEffect } from "react"
import { DashboardNav } from "@/components/dashboard/dashboard-nav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDateTime } from "@/lib/utils"
import { Loader2, TrendingUp, Twitter, Linkedin, Facebook, ExternalLink } from "lucide-react"

interface PostedItem {
  id: string
  platform: string
  postedAt: Date
  postUrl: string | null
  status: string
  content: {
    title: string
    optimizedTitle: string | null
    url: string
    qualityScore: number | null
    engagementScore: number | null
  } | null
}

const PLATFORMS = [
  { id: "twitter", label: "Twitter", icon: Twitter, color: "bg-blue-400" },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin, color: "bg-blue-600" },
  { id: "facebook", label: "Facebook", icon: Facebook, color: "bg-blue-700" },
]

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [postedContent, setPostedContent] = useState<PostedItem[]>([])
  const [stats, setStats] = useState<any[]>([])
  const [postsByPlatform, setPostsByPlatform] = useState<any[]>([])

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/analytics")
      if (response.ok) {
        const data = await response.json()
        setPostedContent(data.postedContent || [])
        setStats(data.stats || [])
        setPostsByPlatform(data.postsByPlatform || [])
      }
    } catch (error) {
      console.error("Error fetching analytics:", error)
    } finally {
      setLoading(false)
    }
  }

  const getPlatformInfo = (platformId: string) => {
    return PLATFORMS.find((p) => p.id === platformId) || PLATFORMS[0]
  }

  const getTotalPosts = () => {
    return postedContent.length
  }

  const getSuccessRate = () => {
    const total = postedContent.length
    if (total === 0) return 0
    const successful = postedContent.filter((p) => p.status === "success").length
    return Math.round((successful / total) * 100)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Analytics & Posting History</h1>
          <p className="text-gray-600">
            Track your automated posts and performance
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats Overview */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{getTotalPosts()}</div>
                  <p className="text-xs text-muted-foreground">
                    Across all platforms
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{getSuccessRate()}%</div>
                  <p className="text-xs text-muted-foreground">
                    Successfully posted
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Platforms</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{postsByPlatform.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Connected accounts
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Posts by Platform */}
            <Card>
              <CardHeader>
                <CardTitle>Posts by Platform</CardTitle>
                <CardDescription>Distribution across social networks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {postsByPlatform.map((item) => {
                    const platform = getPlatformInfo(item.platform)
                    const Icon = platform.icon
                    return (
                      <div key={item.platform} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg ${platform.color} text-white`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className="font-medium">{platform.label}</span>
                        </div>
                        <Badge variant="outline">{item._count} posts</Badge>
                      </div>
                    )
                  })}
                  {postsByPlatform.length === 0 && (
                    <p className="text-sm text-gray-600">No posts yet</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Posting History */}
            <Card>
              <CardHeader>
                <CardTitle>Posting History</CardTitle>
                <CardDescription>Recent automated posts</CardDescription>
              </CardHeader>
              <CardContent>
                {postedContent.length === 0 ? (
                  <p className="text-sm text-gray-600 text-center py-8">
                    No posting history yet. Enable auto-posting in settings to get started.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {postedContent.map((post) => {
                      const platform = getPlatformInfo(post.platform)
                      const Icon = platform.icon
                      return (
                        <div
                          key={post.id}
                          className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center space-x-3 flex-1">
                              <div className={`p-2 rounded-lg ${platform.color} text-white`}>
                                <Icon className="h-4 w-4" />
                              </div>
                              <div className="flex-1">
                                <h4 className="font-semibold">
                                  {post.content?.optimizedTitle || post.content?.title}
                                </h4>
                                <p className="text-xs text-gray-500 mt-1">
                                  {formatDateTime(post.postedAt)}
                                </p>
                              </div>
                            </div>
                            <Badge
                              variant={post.status === "success" ? "default" : "destructive"}
                            >
                              {post.status}
                            </Badge>
                          </div>

                          {post.content && (
                            <div className="flex items-center space-x-4 text-xs text-gray-600 mt-3">
                              {post.content.qualityScore && (
                                <span>Quality: {Math.round(post.content.qualityScore)}%</span>
                              )}
                              {post.content.engagementScore && (
                                <span>
                                  Engagement: {Math.round(post.content.engagementScore)}%
                                </span>
                              )}
                              {post.postUrl && (
                                <a
                                  href={post.postUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline flex items-center"
                                >
                                  View post
                                  <ExternalLink className="h-3 w-3 ml-1" />
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}
