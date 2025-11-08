import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const FEEDS = [
  // News & General Tech
  {
    name: 'TechCrunch',
    url: 'https://techcrunch.com/feed/',
    category: 'news',
    topics: ['startups', 'funding', 'tech', 'ai'],
  },
  {
    name: 'The Verge',
    url: 'https://www.theverge.com/rss/index.xml',
    category: 'news',
    topics: ['tech', 'gadgets', 'software'],
  },
  {
    name: 'Ars Technica',
    url: 'https://feeds.arstechnica.com/arstechnica/index',
    category: 'news',
    topics: ['tech', 'science', 'policy'],
  },
  {
    name: 'Hacker News',
    url: 'https://hnrss.org/frontpage',
    category: 'news',
    topics: ['tech', 'programming', 'startups'],
  },

  // AI & ML
  {
    name: 'MIT Technology Review - AI',
    url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed',
    category: 'ai-ml',
    topics: ['ai', 'ml', 'research'],
  },
  {
    name: 'OpenAI Blog',
    url: 'https://openai.com/blog/rss',
    category: 'ai-ml',
    topics: ['ai', 'gpt', 'research'],
  },
  {
    name: 'Google AI Blog',
    url: 'https://ai.googleblog.com/feeds/posts/default',
    category: 'ai-ml',
    topics: ['ai', 'ml', 'research', 'google'],
  },
  {
    name: 'Towards Data Science',
    url: 'https://towardsdatascience.com/feed',
    category: 'ai-ml',
    topics: ['ai', 'ml', 'data-science'],
  },

  // Startups & Funding
  {
    name: 'Product Hunt',
    url: 'https://www.producthunt.com/feed',
    category: 'product-launches',
    topics: ['startups', 'products', 'launches'],
  },
  {
    name: 'Y Combinator',
    url: 'https://www.ycombinator.com/blog/feed',
    category: 'startups',
    topics: ['startups', 'funding', 'advice'],
  },

  // Jobs (RSS feeds where available)
  {
    name: 'RemoteOK',
    url: 'https://remoteok.com/remote-jobs.rss',
    category: 'jobs',
    topics: ['jobs', 'remote', 'tech'],
  },
  {
    name: 'We Work Remotely',
    url: 'https://weworkremotely.com/categories/remote-programming-jobs.rss',
    category: 'jobs',
    topics: ['jobs', 'remote', 'programming'],
  },

  // Dev & Programming
  {
    name: 'GitHub Blog',
    url: 'https://github.blog/feed/',
    category: 'dev',
    topics: ['github', 'development', 'open-source'],
  },
  {
    name: 'Stack Overflow Blog',
    url: 'https://stackoverflow.blog/feed/',
    category: 'dev',
    topics: ['programming', 'development', 'careers'],
  },
  {
    name: 'Dev.to',
    url: 'https://dev.to/feed',
    category: 'dev',
    topics: ['programming', 'tutorials', 'community'],
  },
]

async function main() {
  console.log('Starting seed...')

  // Clear existing feeds (optional - comment out if you want to keep existing data)
  await prisma.feed.deleteMany({})
  console.log('Cleared existing feeds')

  // Create feeds
  for (const feedData of FEEDS) {
    const feed = await prisma.feed.create({
      data: {
        ...feedData,
        isActive: true,
        fetchInterval: 3600, // 1 hour
      },
    })
    console.log(`Created feed: ${feed.name}`)
  }

  console.log('Seed completed successfully!')
  console.log(`Created ${FEEDS.length} feeds`)
}

main()
  .catch((e) => {
    console.error('Error during seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
