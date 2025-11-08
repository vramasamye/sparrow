import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get("limit") || "50")

    // Get posted content history
    const postedContent = await prisma.postedContent.findMany({
      where: { userId: session.user.id },
      orderBy: { postedAt: "desc" },
      take: limit,
      include: {
        content: {
          select: {
            title: true,
            optimizedTitle: true,
            url: true,
            qualityScore: true,
            engagementScore: true,
          },
        },
      },
    })

    // Get posting statistics
    const stats = await prisma.postedContent.groupBy({
      by: ["platform", "status"],
      where: { userId: session.user.id },
      _count: true,
    })

    // Get total posts by platform
    const postsByPlatform = await prisma.postedContent.groupBy({
      by: ["platform"],
      where: { userId: session.user.id },
      _count: true,
    })

    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentActivity = await prisma.postedContent.groupBy({
      by: ["postedAt"],
      where: {
        userId: session.user.id,
        postedAt: {
          gte: thirtyDaysAgo,
        },
      },
      _count: true,
    })

    return NextResponse.json({
      postedContent,
      stats,
      postsByPlatform,
      recentActivity,
    })
  } catch (error) {
    console.error("Error fetching analytics:", error)
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    )
  }
}
