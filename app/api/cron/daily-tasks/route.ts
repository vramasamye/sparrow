import { NextRequest, NextResponse } from "next/server"
import { ingestAllFeeds, processUnprocessedContent } from "@/lib/rss-ingestion"
import { autoPostForAllUsers } from "@/lib/services/auto-posting"

/**
 * Combined daily cron job for Vercel free tier
 * Runs RSS ingestion, content processing, and auto-posting once per day
 *
 * Schedule: 0 0 * * * (midnight UTC daily)
 */
export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startTime = Date.now()
  const results = {
    rssIngestion: { success: false, feedsProcessed: 0, contentAdded: 0, errors: [] as string[] },
    contentProcessing: { success: false, error: null as string | null },
    autoPosting: { success: false, usersProcessed: 0, postsCreated: 0, errors: [] as string[] },
  }

  try {
    // Step 1: Ingest RSS feeds
    console.log("[DAILY-CRON] Starting RSS ingestion...")
    try {
      const ingestionResult = await ingestAllFeeds()
      results.rssIngestion = {
        success: ingestionResult.errors.length === 0,
        feedsProcessed: ingestionResult.feedsProcessed,
        contentAdded: ingestionResult.contentAdded,
        errors: ingestionResult.errors,
      }
      console.log(`[DAILY-CRON] RSS ingestion complete: ${ingestionResult.contentAdded} new items from ${ingestionResult.feedsProcessed} feeds`)
    } catch (error) {
      console.error("[DAILY-CRON] RSS ingestion failed:", error)
      results.rssIngestion.errors.push(error instanceof Error ? error.message : "Unknown error")
    }

    // Wait between tasks to avoid rate limit issues
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Step 2: Process unprocessed content with AI
    console.log("[DAILY-CRON] Processing unprocessed content...")
    try {
      // Process up to 50 items per day to stay within GROQ rate limits
      await processUnprocessedContent(50)
      results.contentProcessing.success = true
      console.log(`[DAILY-CRON] Content processing complete`)
    } catch (error) {
      console.error("[DAILY-CRON] Content processing failed:", error)
      results.contentProcessing.error = error instanceof Error ? error.message : "Unknown error"
    }

    // Wait between tasks
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Step 3: Auto-post for all users
    console.log("[DAILY-CRON] Starting auto-posting...")
    try {
      const postingResult = await autoPostForAllUsers()
      results.autoPosting = {
        success: postingResult.errors.length === 0,
        usersProcessed: postingResult.usersProcessed,
        postsCreated: postingResult.totalPostsCreated,
        errors: postingResult.errors,
      }
      console.log(`[DAILY-CRON] Auto-posting complete: ${postingResult.totalPostsCreated} posts for ${postingResult.usersProcessed} users`)
    } catch (error) {
      console.error("[DAILY-CRON] Auto-posting failed:", error)
      results.autoPosting.errors.push(error instanceof Error ? error.message : "Unknown error")
    }

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      message: "Daily tasks completed",
      duration: `${(duration / 1000).toFixed(2)}s`,
      timestamp: new Date().toISOString(),
      results,
    })
  } catch (error) {
    console.error("[DAILY-CRON] Fatal error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        results,
      },
      { status: 500 }
    )
  }
}
