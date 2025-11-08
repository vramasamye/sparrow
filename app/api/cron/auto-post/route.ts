import { NextResponse } from "next/server"
import { runAutoPostingForAllUsers } from "@/lib/services/auto-posting"

export const maxDuration = 300 // 5 minutes
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("Starting auto-posting job...")

    // Run auto-posting for all users
    const results = await runAutoPostingForAllUsers()

    const summary = {
      totalUsers: results.length,
      totalPostsCreated: results.reduce((sum, r) => sum + r.postsCreated, 0),
      totalPostsFailed: results.reduce((sum, r) => sum + r.postsFailed, 0),
      results,
    }

    console.log("Auto-posting job completed:", summary)

    return NextResponse.json({
      success: true,
      message: "Auto-posting completed",
      summary,
    })
  } catch (error) {
    console.error("Error in auto-post cron job:", error)
    return NextResponse.json(
      { error: "Failed to run auto-post job" },
      { status: 500 }
    )
  }
}
