# Deployment Guide - Sparrow Platform

This guide will help you deploy the Sparrow content curation platform to production.

## Prerequisites

- PostgreSQL database (Supabase, Neon, or any PostgreSQL provider)
- GROQ API key (free at https://console.groq.com)
- Vercel account (for deployment)

## Environment Setup

### 1. Set Up Database

**Option A: Supabase (Recommended)**
1. Create a new project at https://supabase.com
2. Go to Settings > Database and copy the connection string
3. Replace the password placeholder with your actual password

**Option B: Neon**
1. Create a new project at https://neon.tech
2. Copy the connection string from the dashboard

**Option C: Local PostgreSQL**
```bash
# Install PostgreSQL locally
# macOS
brew install postgresql@15

# Ubuntu/Debian
sudo apt-get install postgresql

# Create database
createdb sparrow
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Database
DATABASE_URL="postgresql://user:password@host:5432/sparrow"

# GROQ API (Get from https://console.groq.com)
GROQ_API_KEY="gsk_xxxxxxxxxxxxx"

# NextAuth (Generate: openssl rand -base64 32)
NEXTAUTH_URL="https://your-domain.vercel.app"
NEXTAUTH_SECRET="your-generated-secret"

# Cron Secret (Generate: openssl rand -base64 32)
CRON_SECRET="your-cron-secret"
```

### 3. Initialize Database

```bash
# Install dependencies if not already done
npm install

# Generate Prisma Client
PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npm run db:generate

# Push schema to database
npm run db:push

# Seed initial RSS feeds
npm run seed
```

## Deployment to Vercel

### 1. Push to GitHub

```bash
git add .
git commit -m "Initial deployment"
git push origin main
```

### 2. Deploy to Vercel

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Configure environment variables:
   - `DATABASE_URL`
   - `GROQ_API_KEY`
   - `NEXTAUTH_URL` (will be your Vercel URL)
   - `NEXTAUTH_SECRET`
   - `CRON_SECRET`

4. Deploy!

### 3. Configure Cron Jobs

Vercel will automatically set up the cron job from `vercel.json`:
- **Path**: `/api/cron/ingest`
- **Schedule**: Every hour (`0 * * * *`)

This will:
1. Fetch content from all active RSS feeds
2. Process new content with GROQ AI
3. Generate quality scores and optimized titles

### 4. Test the Cron Job

```bash
# Test locally
curl -X GET http://localhost:3000/api/cron/ingest \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Test on Vercel
curl -X GET https://your-app.vercel.app/api/cron/ingest \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Alternative Deployment Options

### Deploy to Netlify

1. Install Netlify CLI: `npm install -g netlify-cli`
2. Run: `netlify deploy`
3. Set environment variables in Netlify dashboard
4. Use external cron service for `/api/cron/ingest`

### Deploy to Railway

1. Create account at https://railway.app
2. Create new project from GitHub
3. Add PostgreSQL service
4. Set environment variables
5. Deploy

### Docker Deployment

```dockerfile
# Dockerfile (create this file)
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t sparrow .
docker run -p 3000:3000 --env-file .env sparrow
```

## Post-Deployment Tasks

### 1. Add More RSS Feeds

```bash
# Via API
curl -X POST https://your-app.vercel.app/api/feeds \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Your Feed Name",
    "url": "https://example.com/rss",
    "category": "ai-ml",
    "topics": ["ai", "ml"]
  }'
```

### 2. Monitor Cron Jobs

Check Vercel logs to ensure feeds are being ingested:
```bash
vercel logs --follow
```

### 3. Set Up Database Backups

**Supabase**: Automatic daily backups included

**Neon**: Configure backup retention in dashboard

**Self-hosted**: Set up pg_dump cron:
```bash
# Add to crontab
0 2 * * * pg_dump sparrow > /backups/sparrow_$(date +\%Y\%m\%d).sql
```

### 4. Configure Rate Limiting (Optional)

For production, consider adding rate limiting:

```bash
npm install @vercel/edge-rate-limit
```

### 5. Add Monitoring

Consider integrating:
- **Sentry** for error tracking
- **LogRocket** for session replay
- **PostHog** for analytics

## Scaling Considerations

### Database Optimization

```sql
-- Add indexes for better performance
CREATE INDEX idx_content_published ON content(published_at DESC);
CREATE INDEX idx_content_quality ON content(quality_score DESC);
CREATE INDEX idx_feed_active ON feeds(is_active, last_fetched);
```

### Caching Strategy

Add Redis for caching (optional):
```bash
npm install @vercel/kv
```

### Background Jobs

For high-volume ingestion, consider:
- **Upstash QStash** for reliable background jobs
- **Inngest** for workflow orchestration
- **BullMQ** with Redis for job queues

## Troubleshooting

### Prisma Issues

```bash
# If Prisma client fails
PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma generate

# Reset database (⚠️ deletes all data)
npx prisma migrate reset

# View database in browser
npx prisma studio
```

### Build Errors

```bash
# Clear Next.js cache
rm -rf .next

# Rebuild
npm run build
```

### Database Connection Issues

```bash
# Test connection
npx prisma db push --skip-generate

# Check connection string format
# Should be: postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
```

## Security Checklist

- [ ] Change all default secrets
- [ ] Enable SSL for database connections
- [ ] Set up proper CORS policies
- [ ] Add rate limiting to API routes
- [ ] Enable Vercel password protection (during beta)
- [ ] Configure CSP headers
- [ ] Review and limit API permissions

## Performance Optimization

1. **Enable ISR** (Incremental Static Regeneration)
2. **Add Redis caching** for frequently accessed data
3. **Optimize images** with Next.js Image component
4. **Bundle analysis**: `npm run build -- --analyze`
5. **Database connection pooling** (use Prisma Accelerate)

## Cost Optimization

### Free Tier Limits

- **Vercel**: 100 GB bandwidth, 1000 serverless invocations
- **Supabase**: 500 MB database, 2 GB bandwidth
- **GROQ**: 15 requests/minute, 7000 requests/day

### Tips to Stay Free

1. Use Vercel Edge caching
2. Implement request batching for GROQ
3. Set up proper cache headers
4. Use static generation where possible

## Support & Maintenance

### Regular Tasks

- **Weekly**: Review feed quality and remove low-performing sources
- **Monthly**: Analyze GROQ usage and optimize prompts
- **Quarterly**: Database maintenance and optimization

### Monitoring Endpoints

```bash
# Health check
curl https://your-app.vercel.app/api/health

# Stats
curl https://your-app.vercel.app/api/stats
```

## Next Steps

1. [ ] Set up authentication
2. [ ] Add user preferences
3. [ ] Implement draft scheduling
4. [ ] Connect social media accounts
5. [ ] Build analytics dashboard

For issues and questions, refer to the main [README.md](./README.md) or open an issue on GitHub.
