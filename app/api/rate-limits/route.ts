import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getAllRateLimitStatuses } from "@/lib/services/rate-limiter"

/**
 * Get current rate limit status for all services
 * Useful for monitoring and debugging
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    // Only allow authenticated users to view rate limits
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const statuses = getAllRateLimitStatuses()

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      statuses,
    })
  } catch (error) {
    console.error("Error fetching rate limits:", error)
    return NextResponse.json(
      { error: "Failed to fetch rate limits" },
      { status: 500 }
    )
  }
}
