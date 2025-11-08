import { prisma } from '@/lib/db'
import { generateDraft } from '@/lib/groq'

interface AutoPostResult {
  userId: string
  platform: string
  postsCreated: number
  postsFailed: number
  errors: string[]
}

/**
 * Selects unique content for a user based on their preferences
 * Ensures no duplicates by checking PostedContent table
 */
export async function selectUniqueContent(
  userId: string,
  platform: string,
  limit: number = 6
): Promise<any[]> {
  // Get user preferences
  const preferences = await prisma.userPreferences.findUnique({
    where: { userId },
  })

  if (!preferences || !preferences.topics || preferences.topics.length === 0) {
    return []
  }

  // Get already posted content IDs for this user and platform
  const postedContent = await prisma.postedContent.findMany({
    where: {
      userId,
      platform,
    },
    select: {
      contentId: true,
    },
  })

  const postedContentIds = postedContent.map((pc) => pc.contentId)

  // Find high-quality content matching user topics that hasn't been posted yet
  const content = await prisma.content.findMany({
    where: {
      AND: [
        {
          categories: {
            hasSome: preferences.topics,
          },
        },
        {
          id: {
            notIn: postedContentIds,
          },
        },
        {
          isProcessed: true,
        },
        {
          qualityScore: {
            gte: 60, // Only select high-quality content
          },
        },
      ],
    },
    orderBy: [
      { engagementScore: 'desc' },
      { qualityScore: 'desc' },
      { publishedAt: 'desc' },
    ],
    take: limit * 2, // Get extra to ensure we have enough after filtering
    include: {
      feed: true,
    },
  })

  // Further filter to ensure uniqueness by title similarity
  const uniqueContent: any[] = []
  const seenTitles = new Set<string>()

  for (const item of content) {
    const normalizedTitle = item.title.toLowerCase().trim()
    const titleWords = normalizedTitle.split(' ').slice(0, 5).join(' ')

    if (!seenTitles.has(titleWords)) {
      seenTitles.add(titleWords)
      uniqueContent.push(item)

      if (uniqueContent.length >= limit) {
        break
      }
    }
  }

  return uniqueContent
}

/**
 * Creates and posts drafts automatically for a user
 */
export async function autoPostForUser(
  userId: string,
  platform: string,
  postsPerPlatform: number = 6
): Promise<AutoPostResult> {
  const result: AutoPostResult = {
    userId,
    platform,
    postsCreated: 0,
    postsFailed: 0,
    errors: [],
  }

  try {
    // Check if user has connected this social account
    const socialAccount = await prisma.socialAccount.findUnique({
      where: {
        userId_platform: {
          userId,
          platform,
        },
      },
    })

    if (!socialAccount || !socialAccount.isActive) {
      result.errors.push(`${platform} account not connected or inactive`)
      return result
    }

    // Select unique content
    const contentItems = await selectUniqueContent(userId, platform, postsPerPlatform)

    if (contentItems.length === 0) {
      result.errors.push(`No suitable content found for ${platform}`)
      return result
    }

    // Generate and post drafts for each content item
    for (const content of contentItems) {
      try {
        // Generate draft using GROQ
        const draftBody = await generateDraft(
          content.optimizedTitle || content.title,
          content.summary || content.description || '',
          platform
        )

        // Create draft
        const draft = await prisma.draft.create({
          data: {
            userId,
            contentId: content.id,
            title: content.optimizedTitle || content.title,
            body: draftBody,
            platform,
            status: 'published',
            isAIGenerated: true,
            publishedAt: new Date(),
          },
        })

        // Simulate posting (in real implementation, call actual social media APIs)
        const postUrl = await publishToSocialMedia(socialAccount, draftBody, platform)

        // Track posted content
        await prisma.postedContent.create({
          data: {
            userId,
            contentId: content.id,
            platform,
            draftId: draft.id,
            postUrl,
            status: 'success',
          },
        })

        // Create analytics entry
        await prisma.analytics.create({
          data: {
            draftId: draft.id,
            platform,
          },
        })

        result.postsCreated++
      } catch (error: any) {
        result.postsFailed++
        result.errors.push(`Failed to post content ${content.id}: ${error.message}`)
        console.error(`Error posting content ${content.id}:`, error)
      }
    }
  } catch (error: any) {
    result.errors.push(`Auto-post failed: ${error.message}`)
    console.error('Auto-post error:', error)
  }

  return result
}

/**
 * Publishes content to social media platform
 * This is a placeholder - in production, integrate with actual APIs
 */
async function publishToSocialMedia(
  socialAccount: any,
  content: string,
  platform: string
): Promise<string> {
  // In production, implement actual API calls here
  // For now, return a mock URL

  // Example for Twitter:
  // const twitter = new TwitterApi({
  //   appKey: process.env.TWITTER_API_KEY!,
  //   appSecret: process.env.TWITTER_API_SECRET!,
  //   accessToken: socialAccount.accessToken!,
  //   accessSecret: socialAccount.refreshToken!,
  // })
  // const tweet = await twitter.v2.tweet(content)
  // return `https://twitter.com/user/status/${tweet.data.id}`

  // Mock implementation
  console.log(`[MOCK] Publishing to ${platform}:`, content.substring(0, 50))
  return `https://${platform}.com/post/${Date.now()}`
}

/**
 * Run auto-posting for all users with auto-post enabled
 */
export async function runAutoPostingForAllUsers(): Promise<AutoPostResult[]> {
  const results: AutoPostResult[] = []

  try {
    // Find all users with auto-posting enabled
    const usersWithAutoPost = await prisma.userPreferences.findMany({
      where: {
        autoPostEnabled: true,
        selectedPlatforms: {
          isEmpty: false,
        },
      },
      include: {
        user: true,
      },
    })

    console.log(`Running auto-post for ${usersWithAutoPost.length} users`)

    for (const userPref of usersWithAutoPost) {
      for (const platform of userPref.selectedPlatforms) {
        const result = await autoPostForUser(
          userPref.userId,
          platform,
          userPref.postsPerPlatform
        )
        results.push(result)
      }
    }
  } catch (error) {
    console.error('Error in runAutoPostingForAllUsers:', error)
  }

  return results
}
