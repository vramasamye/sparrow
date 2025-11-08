"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle, Clock } from "lucide-react"

interface RateLimitStatus {
  availableTokens: number
  maxTokens: number
  concurrentRequests: number
  maxConcurrent: number
  queueLength: number
}

interface RateLimitData {
  timestamp: string
  statuses: Record<string, RateLimitStatus>
}

export function RateLimitMonitor() {
  const [data, setData] = useState<RateLimitData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRateLimits()
    const interval = setInterval(fetchRateLimits, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchRateLimits = async () => {
    try {
      const response = await fetch("/api/rate-limits")
      if (response.ok) {
        const rateLimitData = await response.json()
        setData(rateLimitData)
      }
    } catch (error) {
      console.error("Error fetching rate limits:", error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (available: number, max: number): string => {
    const percentage = (available / max) * 100
    if (percentage > 50) return "text-green-600"
    if (percentage > 20) return "text-yellow-600"
    return "text-red-600"
  }

  const getStatusIcon = (available: number, max: number) => {
    const percentage = (available / max) * 100
    if (percentage > 50) return <CheckCircle className="h-4 w-4 text-green-600" />
    if (percentage > 20) return <Clock className="h-4 w-4 text-yellow-600" />
    return <AlertCircle className="h-4 w-4 text-red-600" />
  }

  const formatServiceName = (service: string): string => {
    const names: Record<string, string> = {
      groq: "GROQ AI",
      twitter: "Twitter",
      linkedin: "LinkedIn",
      facebook: "Facebook",
      rss: "RSS Feeds",
      newsapi: "News API",
    }
    return names[service] || service
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Rate Limits</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!data) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Rate Limits</CardTitle>
        <CardDescription>
          Monitor rate limit usage across all services
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Object.entries(data.statuses).map(([service, status]) => (
            <div
              key={service}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="flex items-center space-x-3">
                {getStatusIcon(status.availableTokens, status.maxTokens)}
                <div>
                  <p className="font-medium">{formatServiceName(service)}</p>
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <span>
                      {status.availableTokens}/{status.maxTokens} tokens
                    </span>
                    {status.concurrentRequests > 0 && (
                      <span className="text-blue-600">
                        • {status.concurrentRequests} active
                      </span>
                    )}
                    {status.queueLength > 0 && (
                      <span className="text-yellow-600">
                        • {status.queueLength} queued
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div
                  className={`text-2xl font-bold ${getStatusColor(
                    status.availableTokens,
                    status.maxTokens
                  )}`}
                >
                  {Math.round((status.availableTokens / status.maxTokens) * 100)}%
                </div>
                <Badge
                  variant={
                    status.availableTokens > status.maxTokens * 0.5
                      ? "default"
                      : status.availableTokens > status.maxTokens * 0.2
                      ? "outline"
                      : "destructive"
                  }
                >
                  {status.availableTokens > status.maxTokens * 0.5
                    ? "Healthy"
                    : status.availableTokens > status.maxTokens * 0.2
                    ? "Warning"
                    : "Critical"}
                </Badge>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-xs text-gray-500 text-center">
          Last updated: {new Date(data.timestamp).toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  )
}
