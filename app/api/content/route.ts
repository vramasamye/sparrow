import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const topic = searchParams.get("topic")
    const limit = parseInt(searchParams.get("limit") || "20")
    const offset = parseInt(searchParams.get("offset") || "0")

    const where = topic
      ? { categories: { has: topic } }
      : {}

    const content = await prisma.content.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { publishedAt: "desc" },
      include: { feed: true },
    })

    const total = await prisma.content.count({ where })

    return NextResponse.json({
      content,
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error("Error fetching content:", error)
    return NextResponse.json(
      { error: "Failed to fetch content" },
      { status: 500 }
    )
  }
}
