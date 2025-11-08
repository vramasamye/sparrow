import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

const socialAccountSchema = z.object({
  platform: z.enum(["twitter", "linkedin", "facebook"]),
  accountName: z.string().min(1),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
})

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const accounts = await prisma.socialAccount.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        platform: true,
        accountName: true,
        isActive: true,
        createdAt: true,
        tokenExpiry: true,
      },
    })

    return NextResponse.json(accounts)
  } catch (error) {
    console.error("Error fetching social accounts:", error)
    return NextResponse.json(
      { error: "Failed to fetch social accounts" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const result = socialAccountSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      )
    }

    const { platform, accountName, accessToken, refreshToken } = result.data

    // Check if account already exists
    const existing = await prisma.socialAccount.findUnique({
      where: {
        userId_platform: {
          userId: session.user.id,
          platform,
        },
      },
    })

    if (existing) {
      // Update existing account
      const account = await prisma.socialAccount.update({
        where: { id: existing.id },
        data: {
          accountName,
          accessToken,
          refreshToken,
          isActive: true,
        },
        select: {
          id: true,
          platform: true,
          accountName: true,
          isActive: true,
          createdAt: true,
        },
      })
      return NextResponse.json(account)
    } else {
      // Create new account
      const account = await prisma.socialAccount.create({
        data: {
          userId: session.user.id,
          platform,
          accountName,
          accessToken,
          refreshToken,
          isActive: true,
        },
        select: {
          id: true,
          platform: true,
          accountName: true,
          isActive: true,
          createdAt: true,
        },
      })
      return NextResponse.json(account, { status: 201 })
    }
  } catch (error) {
    console.error("Error creating social account:", error)
    return NextResponse.json(
      { error: "Failed to create social account" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Account ID required" }, { status: 400 })
    }

    // Verify ownership
    const account = await prisma.socialAccount.findUnique({
      where: { id },
    })

    if (!account || account.userId !== session.user.id) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 })
    }

    await prisma.socialAccount.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting social account:", error)
    return NextResponse.json(
      { error: "Failed to delete social account" },
      { status: 500 }
    )
  }
}
