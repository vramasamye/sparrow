import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  try {
    const feeds = await prisma.feed.findMany({
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(feeds)
  } catch (error) {
    console.error("Error fetching feeds:", error)
    return NextResponse.json({ error: "Failed to fetch feeds" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, url, category, topics } = body

    if (!name || !url || !category) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const feed = await prisma.feed.create({
      data: {
        name,
        url,
        category,
        topics: topics || [],
        isActive: true,
      },
    })

    return NextResponse.json(feed, { status: 201 })
  } catch (error) {
    console.error("Error creating feed:", error)
    return NextResponse.json({ error: "Failed to create feed" }, { status: 500 })
  }
}
