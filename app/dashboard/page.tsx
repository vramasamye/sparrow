import { Suspense } from "react"
import { ContentFeed } from "@/components/dashboard/content-feed"
import { DashboardNav } from "@/components/dashboard/dashboard-nav"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { RateLimitMonitor } from "@/components/dashboard/rate-limit-monitor"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-gray-600">
            Welcome back! Here's your content overview
          </p>
        </div>

        <Suspense fallback={<div>Loading stats...</div>}>
          <StatsCards />
        </Suspense>

        <div className="grid lg:grid-cols-3 gap-6 mt-8">
          {/* Main Content Feed */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent Content</CardTitle>
                <CardDescription>
                  Latest curated content from your feeds
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<div>Loading content...</div>}>
                  <ContentFeed />
                </Suspense>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <button className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors">
                  Create Draft
                </button>
                <button className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors">
                  Add Feed
                </button>
                <button className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors">
                  Manage Topics
                </button>
                <button className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors">
                  Connect Social Account
                </button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Active Feeds</CardTitle>
                <CardDescription>Currently monitoring 0 feeds</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  Add your first RSS feed to get started
                </p>
              </CardContent>
            </Card>

            <RateLimitMonitor />
          </div>
        </div>
      </main>
    </div>
  )
}
