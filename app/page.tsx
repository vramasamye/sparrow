import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Sparkles, Rss, Zap, TrendingUp, Calendar, BarChart } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">Sparrow</span>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/dashboard">
              <Button variant="ghost">Dashboard</Button>
            </Link>
            <Link href="/auth/signin">
              <Button>Sign In</Button>
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          AI-Powered Content Curation
          <br />
          <span className="text-blue-600">Made Simple</span>
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Aggregate content from multiple sources, enhance it with AI, and share engaging posts
          across all your social media platforms - all in one place.
        </p>
        <div className="flex items-center justify-center space-x-4">
          <Link href="/auth/signup">
            <Button size="lg">Get Started Free</Button>
          </Link>
          <Link href="#features">
            <Button size="lg" variant="outline">
              Learn More
            </Button>
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">
          Everything You Need to Curate & Share
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <Rss className="h-10 w-10 text-blue-600 mb-2" />
              <CardTitle>Smart Content Aggregation</CardTitle>
              <CardDescription>
                Automatically fetch content from RSS feeds, job boards, news sources, and more
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Sparkles className="h-10 w-10 text-blue-600 mb-2" />
              <CardTitle>AI Enhancement</CardTitle>
              <CardDescription>
                GROQ-powered content analysis, optimization, and engagement prediction
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Zap className="h-10 w-10 text-blue-600 mb-2" />
              <CardTitle>Auto-Generated Drafts</CardTitle>
              <CardDescription>
                AI creates social-ready posts from your curated content automatically
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <TrendingUp className="h-10 w-10 text-blue-600 mb-2" />
              <CardTitle>Topic-Based Filtering</CardTitle>
              <CardDescription>
                Organize content by topics: AI/ML, funding, jobs, product launches, and more
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Calendar className="h-10 w-10 text-blue-600 mb-2" />
              <CardTitle>Smart Scheduling</CardTitle>
              <CardDescription>
                Schedule posts across Twitter, LinkedIn, and other platforms with ease
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <BarChart className="h-10 w-10 text-blue-600 mb-2" />
              <CardTitle>Analytics & Insights</CardTitle>
              <CardDescription>
                Track engagement, performance, and optimize your content strategy
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-4 py-20 bg-gray-50 rounded-lg">
        <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
        <div className="grid md:grid-cols-4 gap-8">
          <div className="text-center">
            <div className="bg-blue-600 text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              1
            </div>
            <h3 className="font-semibold mb-2">Connect Sources</h3>
            <p className="text-gray-600">Add RSS feeds and select your topics of interest</p>
          </div>
          <div className="text-center">
            <div className="bg-blue-600 text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              2
            </div>
            <h3 className="font-semibold mb-2">AI Processing</h3>
            <p className="text-gray-600">
              Content is analyzed, enhanced, and scored for quality
            </p>
          </div>
          <div className="text-center">
            <div className="bg-blue-600 text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              3
            </div>
            <h3 className="font-semibold mb-2">Review Drafts</h3>
            <p className="text-gray-600">
              AI generates social media posts you can edit and customize
            </p>
          </div>
          <div className="text-center">
            <div className="bg-blue-600 text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              4
            </div>
            <h3 className="font-semibold mb-2">Schedule & Share</h3>
            <p className="text-gray-600">Post immediately or schedule for optimal engagement</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-4xl font-bold mb-6">Ready to Elevate Your Content Game?</h2>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Join thousands of content creators and marketers who use Sparrow to stay ahead
        </p>
        <Link href="/auth/signup">
          <Button size="lg">Start Free Trial</Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t mt-20">
        <div className="container mx-auto px-4 py-8 text-center text-gray-600">
          <p>&copy; 2024 Sparrow. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
