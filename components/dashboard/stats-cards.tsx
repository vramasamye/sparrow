import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Rss, TrendingUp, Calendar } from "lucide-react"

export async function StatsCards() {
  // In a real app, fetch these from your database
  const stats = {
    totalContent: 0,
    activeFeeds: 0,
    drafts: 0,
    scheduledPosts: 0,
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Content</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalContent}</div>
          <p className="text-xs text-muted-foreground">Curated articles</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Feeds</CardTitle>
          <Rss className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.activeFeeds}</div>
          <p className="text-xs text-muted-foreground">RSS sources</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Drafts</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.drafts}</div>
          <p className="text-xs text-muted-foreground">Ready to post</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.scheduledPosts}</div>
          <p className="text-xs text-muted-foreground">Upcoming posts</p>
        </CardContent>
      </Card>
    </div>
  )
}
