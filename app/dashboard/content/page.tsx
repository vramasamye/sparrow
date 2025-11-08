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
import { Loader2, Search, ExternalLink, Sparkles, FileText, RefreshCw, Filter } from "lucide-react"

interface ContentItem {
  id: string
  title: string
  description: string | null
  url: string
  publishedAt: Date | null
  optimizedTitle: string | null
  summary: string | null
  qualityScore: number | null
  engagementScore: number | null
  suggestedTags: string[]
  categories: string[]
  feed: {
    name: string
    category: string
  }
}

const TOPIC_FILTERS = [
  "All",
  "tech",
  "ai",
  "ml",
  "startups",
  "funding",
  "jobs",
  "programming",
  "data-science",
]

export default function ContentPage() {
  const { data: session } = useSession()
  const [content, setContent] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedTopic, setSelectedTopic] = useState("All")
  const [generating, setGenerating] = useState<string | null>(null)

  useEffect(() => {
    fetchContent()
  }, [selectedTopic])

  const fetchContent = async () => {
    setLoading(true)
    try {
      const url =
        selectedTopic === "All"
          ? "/api/content?limit=50"
          : `/api/content?topic=${selectedTopic}&limit=50`

      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setContent(data.content || [])
      }
    } catch (error) {
      console.error("Error fetching content:", error)
    } finally {
      setLoading(false)
    }
  }

  const generateDraft = async (contentId: string, platform: string) => {
    if (!session?.user?.id) return

    setGenerating(contentId)
    try {
      const response = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId,
          platform,
          userId: session.user.id,
        }),
      })

      if (response.ok) {
        alert("Draft generated successfully! Check the Drafts page.")
      } else {
        alert("Failed to generate draft")
      }
    } catch (error) {
      console.error("Error generating draft:", error)
      alert("Failed to generate draft")
    } finally {
      setGenerating(null)
    }
  }

  const filteredContent = content.filter((item) =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.optimizedTitle?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Content Curation</h1>
          <p className="text-gray-600">
            Browse and curate content from your feeds
          </p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  <Filter className="h-5 w-5 mr-2" />
                  Filters
                </CardTitle>
                <CardDescription>Filter and search content</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchContent}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search */}
            <div>
              <Label>Search</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search articles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Topic Filters */}
            <div>
              <Label>Topics</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {TOPIC_FILTERS.map((topic) => (
                  <Badge
                    key={topic}
                    variant={selectedTopic === topic ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setSelectedTopic(topic)}
                  >
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : filteredContent.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-gray-600">
                No content found. Try adjusting your filters or add more RSS feeds.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredContent.map((item) => (
              <Card key={item.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">{item.title}</h3>
                      {item.optimizedTitle && item.optimizedTitle !== item.title && (
                        <div className="flex items-center text-sm text-blue-600 mb-2">
                          <Sparkles className="h-3 w-3 mr-1" />
                          <span className="italic">{item.optimizedTitle}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      {item.qualityScore && (
                        <Badge
                          variant={item.qualityScore > 70 ? "default" : "secondary"}
                        >
                          Quality: {Math.round(item.qualityScore)}%
                        </Badge>
                      )}
                      {item.engagementScore && (
                        <Badge variant="outline">
                          Engagement: {Math.round(item.engagementScore)}%
                        </Badge>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {item.summary || item.description}
                  </p>

                  {/* Tags */}
                  {item.suggestedTags && item.suggestedTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {item.suggestedTags.slice(0, 5).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span className="font-medium">{item.feed.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {item.feed.category}
                      </Badge>
                      <span>{formatDateTime(item.publishedAt)}</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="outline" size="sm">
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Read
                        </Button>
                      </a>

                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => generateDraft(item.id, "twitter")}
                        disabled={generating === item.id}
                      >
                        {generating === item.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <FileText className="h-4 w-4 mr-1" />
                            Generate Draft
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Results count */}
        {!loading && filteredContent.length > 0 && (
          <div className="mt-4 text-center text-sm text-gray-600">
            Showing {filteredContent.length} of {content.length} articles
          </div>
        )}
      </main>
    </div>
  )
}
