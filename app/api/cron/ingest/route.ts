import { NextResponse } from "next/server"
import { ingestAllFeeds, processUnprocessedContent } from "@/lib/rss-ingestion"

export const maxDuration = 300 // 5 minutes
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Ingest all feeds
    await ingestAllFeeds()

    // Process unprocessed content (batch of 20)
    await processUnprocessedContent(20)

    return NextResponse.json({
      success: true,
      message: "Feed ingestion and processing completed",
    })
  } catch (error) {
    console.error("Error in cron job:", error)
    return NextResponse.json(
      { error: "Failed to run cron job" },
      { status: 500 }
    )
  }
}
