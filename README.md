# Sparrow - Content Curation & Social Sharing Platform

AI-powered content curation and social media management platform built with Next.js 14, Prisma, and GROQ.

## Features

### Phase 1 (MVP) - Implemented

- Next.js 14+ with App Router and TypeScript
- Tailwind CSS + Shadcn/ui components
- PostgreSQL database with Prisma ORM
- RSS feed ingestion system with deduplication
- GROQ AI integration for content analysis
- Content quality scoring and optimization
- Automated draft generation
- Modern dashboard UI
- Topic-based categorization
- RESTful API routes

### Phase 2 (Coming Soon)

- Advanced GROQ-powered content moderation
- Enhanced draft generation with platform-specific optimization
- User authentication with NextAuth.js
- User preferences and topic selection
- Advanced content curation tools

### Phase 3 (Future)

- Social media posting integration (Twitter, LinkedIn, Facebook)
- Advanced scheduling system
- Analytics dashboard
- Engagement tracking

## Tech Stack

- **Frontend**: Next.js 14+ with App Router, React 18, TypeScript
- **Styling**: Tailwind CSS, Shadcn/ui components
- **Database**: PostgreSQL with Prisma ORM
- **AI**: GROQ API (Mixtral-8x7b model)
- **Authentication**: NextAuth.js (planned)
- **Deployment**: Vercel-ready

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- GROQ API key (free at https://console.groq.com)

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd sparrow
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add your configuration:
- `DATABASE_URL`: Your PostgreSQL connection string
- `GROQ_API_KEY`: Your GROQ API key
- `NEXTAUTH_SECRET`: Generate with `openssl rand -base64 32`
- `CRON_SECRET`: Generate with `openssl rand -base64 32`

4. Set up the database:
```bash
npx prisma migrate dev --name init
npx prisma generate
```

5. Seed initial RSS feeds (optional):
```bash
npm run seed
```

6. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Database Schema

The platform uses the following main models:

- **User**: User accounts and authentication
- **Feed**: RSS feed sources
- **Content**: Aggregated content items
- **Draft**: Generated social media drafts
- **UserPreferences**: User topic preferences and settings
- **SocialAccount**: Connected social media accounts
- **Analytics**: Engagement metrics tracking

## API Routes

### Feeds
- `GET /api/feeds` - List all feeds
- `POST /api/feeds` - Create a new feed

### Content
- `GET /api/content?topic=ai&limit=20` - Get content with filtering

### Drafts
- `GET /api/drafts` - List all drafts
- `POST /api/drafts` - Generate a new draft from content

### Cron Jobs
- `GET /api/cron/ingest` - Run feed ingestion (secured with CRON_SECRET)

## RSS Feeds & Content Sources

The platform supports content from various sources:

### News & Tech
- TechCrunch, The Verge, Ars Technica, Wired, MIT Technology Review

### AI & ML
- AI Weekly, Import AI, The Batch, KDnuggets, Analytics Vidhya

### Job Boards
- RemoteOK, We Work Remotely, Stack Overflow Jobs, GitHub Jobs

### Funding & Startups
- Crunchbase, Product Hunt, Startup Digest

## GROQ Integration

The platform uses GROQ for AI-powered features:

1. **Content Analysis**: Quality scoring (0-100)
2. **Title Optimization**: Generate engaging headlines
3. **Summarization**: Create concise summaries
4. **Tag Suggestion**: AI-suggested relevant tags
5. **Engagement Prediction**: Predict social media performance
6. **Draft Generation**: Create platform-specific social posts

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Database Migration

For production, run:
```bash
npx prisma migrate deploy
```

## Scheduled Jobs

Set up a cron job to regularly fetch and process content:

**Vercel Cron** (vercel.json):
```json
{
  "crons": [{
    "path": "/api/cron/ingest",
    "schedule": "0 * * * *"
  }]
}
```

Or use external services like:
- Vercel Cron
- GitHub Actions
- EasyCron
- Cron-job.org

Example cURL:
```bash
curl -X GET https://your-app.vercel.app/api/cron/ingest \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Development

### Project Structure

```
sparrow/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard pages
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Landing page
├── components/            # React components
│   ├── ui/               # Shadcn/ui components
│   └── dashboard/        # Dashboard components
├── lib/                   # Utility functions
│   ├── db.ts             # Prisma client
│   ├── groq.ts           # GROQ integration
│   ├── rss-ingestion.ts  # RSS feed processing
│   └── utils.ts          # Helper functions
├── prisma/               # Database schema and migrations
│   └── schema.prisma
└── package.json
```

### Adding New Feeds

Create feeds via API:

```bash
curl -X POST http://localhost:3000/api/feeds \
  -H "Content-Type: application/json" \
  -d '{
    "name": "TechCrunch",
    "url": "https://techcrunch.com/feed/",
    "category": "news",
    "topics": ["startups", "funding", "tech"]
  }'
```

### Processing Content

Content is processed in two steps:

1. **Ingestion**: Fetch RSS feeds and store content
2. **Processing**: Analyze with GROQ and enhance

Run manually:
```bash
# Via API
curl -X GET http://localhost:3000/api/cron/ingest \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
