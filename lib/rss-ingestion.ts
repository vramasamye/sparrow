import Parser from 'rss-parser'
import { prisma } from './db'
import { analyzeContent } from './groq'
import crypto from 'crypto'

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'media'],
      ['content:encoded', 'contentEncoded'],
    ],
  },
})

export interface FeedItem {
  title: string
  link: string
  description?: string
  content?: string
  author?: string
  publishedAt?: Date
  categories?: string[]
}

function generateContentHash(url: string, title: string): string {
  return crypto
    .createHash('sha256')
    .update(`${url}-${title}`)
    .digest('hex')
}

export async function fetchFeed(feedUrl: string): Promise<FeedItem[]> {
  try {
    const feed = await parser.parseURL(feedUrl)

    return feed.items.map((item) => ({
      title: item.title || 'Untitled',
      link: item.link || '',
      description: item.contentSnippet || item.description || '',
      content: (item as any).contentEncoded || item.content || item.contentSnippet || '',
      author: item.creator || item.author || '',
      publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
      categories: item.categories || [],
    }))
  } catch (error) {
    console.error(`Error fetching feed ${feedUrl}:`, error)
    return []
  }
}

export async function ingestFeed(feedId: string): Promise<number> {
  try {
    const feed = await prisma.feed.findUnique({
      where: { id: feedId },
    })

    if (!feed || !feed.isActive) {
      console.log(`Feed ${feedId} is not active or not found`)
      return 0
    }

    const items = await fetchFeed(feed.url)
    let newItemsCount = 0

    for (const item of items) {
      const contentHash = generateContentHash(item.link, item.title)

      // Check if content already exists (deduplication)
      const existing = await prisma.content.findUnique({
        where: { contentHash },
      })

      if (existing) {
        console.log(`Skipping duplicate: ${item.title}`)
        continue
      }

      // Create new content entry
      await prisma.content.create({
        data: {
          feedId: feed.id,
          title: item.title,
          description: item.description,
          content: item.content,
          url: item.link,
          author: item.author,
          publishedAt: item.publishedAt,
          categories: [...(item.categories || []), ...feed.topics],
          contentHash,
          isProcessed: false,
        },
      })

      newItemsCount++
    }

    // Update feed's lastFetched timestamp
    await prisma.feed.update({
      where: { id: feedId },
      data: { lastFetched: new Date() },
    })

    console.log(`Ingested ${newItemsCount} new items from ${feed.name}`)
    return newItemsCount
  } catch (error) {
    console.error(`Error ingesting feed ${feedId}:`, error)
    return 0
  }
}

export async function processContent(contentId: string): Promise<void> {
  try {
    const content = await prisma.content.findUnique({
      where: { id: contentId },
    })

    if (!content || content.isProcessed) {
      return
    }

    // Analyze content with GROQ
    const analysis = await analyzeContent(
      content.title,
      content.content || content.description || '',
      content.categories
    )

    // Update content with AI analysis
    await prisma.content.update({
      where: { id: contentId },
      data: {
        qualityScore: analysis.qualityScore,
        optimizedTitle: analysis.optimizedTitle,
        summary: analysis.summary,
        suggestedTags: analysis.suggestedTags,
        engagementScore: analysis.engagementScore,
        isProcessed: true,
      },
    })

    console.log(`Processed content: ${content.title}`)
  } catch (error) {
    console.error(`Error processing content ${contentId}:`, error)
  }
}

export async function ingestAllFeeds(): Promise<{
  feedsProcessed: number
  contentAdded: number
  errors: string[]
}> {
  const result = {
    feedsProcessed: 0,
    contentAdded: 0,
    errors: [] as string[],
  }

  try {
    const feeds = await prisma.feed.findMany({
      where: { isActive: true },
    })

    console.log(`Starting ingestion of ${feeds.length} feeds...`)

    for (const feed of feeds) {
      try {
        const newItems = await ingestFeed(feed.id)
        result.feedsProcessed++
        result.contentAdded += newItems
        // Small delay to avoid overwhelming sources
        await new Promise((resolve) => setTimeout(resolve, 1000))
      } catch (error) {
        const errorMsg = `Failed to ingest ${feed.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        result.errors.push(errorMsg)
        console.error(errorMsg)
      }
    }

    console.log(`Feed ingestion completed: ${result.contentAdded} new items from ${result.feedsProcessed} feeds`)
  } catch (error) {
    console.error('Error in ingestAllFeeds:', error)
    result.errors.push(error instanceof Error ? error.message : 'Unknown error')
  }

  return result
}

export async function processUnprocessedContent(limit: number = 10): Promise<void> {
  try {
    const unprocessedContent = await prisma.content.findMany({
      where: { isProcessed: false },
      take: limit,
      orderBy: { createdAt: 'desc' },
    })

    console.log(`Processing ${unprocessedContent.length} unprocessed items...`)

    for (const content of unprocessedContent) {
      await processContent(content.id)
      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    console.log('Content processing completed')
  } catch (error) {
    console.error('Error in processUnprocessedContent:', error)
  }
}
