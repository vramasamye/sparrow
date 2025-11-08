import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { generateDraft } from "@/lib/groq"

export async function GET() {
  try {
    const drafts = await prisma.draft.findMany({
      orderBy: { createdAt: "desc" },
      include: { content: true },
    })
    return NextResponse.json(drafts)
  } catch (error) {
    console.error("Error fetching drafts:", error)
    return NextResponse.json({ error: "Failed to fetch drafts" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { contentId, platform, userId } = body

    if (!contentId || !platform || !userId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Fetch the content
    const content = await prisma.content.findUnique({
      where: { id: contentId },
    })

    if (!content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 })
    }

    // Generate draft using GROQ
    const draftBody = await generateDraft(
      content.optimizedTitle || content.title,
      content.summary || content.description || "",
      platform
    )

    // Create draft
    const draft = await prisma.draft.create({
      data: {
        userId,
        contentId,
        title: content.optimizedTitle || content.title,
        body: draftBody,
        platform,
        status: "draft",
        isAIGenerated: true,
      },
    })

    return NextResponse.json(draft, { status: 201 })
  } catch (error) {
    console.error("Error creating draft:", error)
    return NextResponse.json({ error: "Failed to create draft" }, { status: 500 })
  }
}
