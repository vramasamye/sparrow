# Quick Start Guide

Get Sparrow running locally in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database (or use Supabase free tier)
- GROQ API key (free at https://console.groq.com)

## Installation

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd sparrow
npm install
```

### 2. Set Up Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/sparrow"
GROQ_API_KEY="your-groq-api-key"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="run: openssl rand -base64 32"
CRON_SECRET="run: openssl rand -base64 32"
```

### 3. Initialize Database

```bash
# Generate Prisma client (skip checksum in restricted environments)
PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma generate

# Create database tables
npx prisma db push

# Seed with initial RSS feeds
npm run seed
```

### 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Testing the Platform

### 1. View the Landing Page

Navigate to http://localhost:3000 - you'll see the marketing page with features and benefits.

### 2. Access the Dashboard

Go to http://localhost:3000/dashboard - the main content management interface.

### 3. Add Your First Feed

```bash
curl -X POST http://localhost:3000/api/feeds \
  -H "Content-Type: application/json" \
  -d '{
    "name": "TechCrunch AI",
    "url": "https://techcrunch.com/category/artificial-intelligence/feed/",
    "category": "ai-ml",
    "topics": ["ai", "startups"]
  }'
```

### 4. Ingest Content

```bash
curl -X GET http://localhost:3000/api/cron/ingest \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

This will:
- Fetch articles from all active feeds
- Analyze them with GROQ AI
- Generate quality scores and optimized titles
- Store in database

### 5. View Content

Refresh the dashboard at http://localhost:3000/dashboard to see curated content.

## Quick API Reference

### List All Feeds
```bash
curl http://localhost:3000/api/feeds
```

### Get Content
```bash
# All content
curl http://localhost:3000/api/content

# Filtered by topic
curl http://localhost:3000/api/content?topic=ai

# With pagination
curl http://localhost:3000/api/content?limit=10&offset=0
```

### Generate Draft
```bash
curl -X POST http://localhost:3000/api/drafts \
  -H "Content-Type: application/json" \
  -d '{
    "contentId": "content-id-here",
    "platform": "twitter",
    "userId": "user-id-here"
  }'
```

### List Drafts
```bash
curl http://localhost:3000/api/drafts
```

## Database Management

### View Data in Browser
```bash
npx prisma studio
```
Opens at http://localhost:5555

### Reset Database
```bash
npx prisma migrate reset
npm run seed
```

## Common Issues

### Prisma Generate Fails

```bash
# Use this in restricted environments
PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma generate
```

### Database Connection Error

Check your `DATABASE_URL` format:
```
postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE
```

For Supabase, add `?sslmode=require`:
```
postgresql://user:pass@host:5432/db?sslmode=require
```

### GROQ API Errors

1. Verify your API key at https://console.groq.com
2. Check rate limits (15 req/min on free tier)
3. Ensure `GROQ_API_KEY` is set in `.env`

### Port 3000 Already in Use

```bash
# Use different port
PORT=3001 npm run dev
```

## Next Steps

- [ ] Review the [README.md](./README.md) for full documentation
- [ ] Check [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment
- [ ] Explore the database schema in `prisma/schema.prisma`
- [ ] Add more RSS feeds relevant to your interests
- [ ] Customize the GROQ prompts in `lib/groq.ts`
- [ ] Set up authentication (Phase 2)
- [ ] Connect social media accounts (Phase 3)

## Getting Help

- Read the full documentation in README.md
- Check the codebase structure
- Open an issue on GitHub
- Review the Prisma schema for data models

Happy curating!
