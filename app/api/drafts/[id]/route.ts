import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()

    // Verify the draft belongs to the user
    const existingDraft = await prisma.draft.findUnique({
      where: { id },
    })

    if (!existingDraft || existingDraft.userId !== session.user.id) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 })
    }

    // Update the draft
    const draft = await prisma.draft.update({
      where: { id },
      data: {
        body: body.body,
        scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : undefined,
        status: body.status || undefined,
      },
    })

    return NextResponse.json(draft)
  } catch (error) {
    console.error("Error updating draft:", error)
    return NextResponse.json(
      { error: "Failed to update draft" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = params

    // Verify the draft belongs to the user
    const existingDraft = await prisma.draft.findUnique({
      where: { id },
    })

    if (!existingDraft || existingDraft.userId !== session.user.id) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 })
    }

    // Delete the draft
    await prisma.draft.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting draft:", error)
    return NextResponse.json(
      { error: "Failed to delete draft" },
      { status: 500 }
    )
  }
}
