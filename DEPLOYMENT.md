# Sparrow Deployment Guide

## Vercel Free Tier Deployment

This guide will help you deploy Sparrow to Vercel's **free (Hobby) tier** with all features optimized for the free tier limitations.

### What's Optimized for Free Tier

✅ **Single daily cron job** (Vercel free tier allows 1 cron per day)
✅ **Combined RSS ingestion, AI processing, and auto-posting** in one daily task
✅ **Rate limiting** configured to respect all API free tiers
✅ **PostgreSQL** compatible with free database services (Neon, Supabase)
✅ **GROQ API** free tier (30 req/min, 14,400/day)

---

## Prerequisites

1. **Vercel Account** - Sign up at [vercel.com](https://vercel.com)
2. **GROQ API Key** - Get free key at [console.groq.com](https://console.groq.com)
3. **PostgreSQL Database** - Choose one:
   - [Neon](https://neon.tech) - Recommended, generous free tier
   - [Supabase](https://supabase.com) - Free tier with 500MB
   - [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres) - Free tier

---

## Quick Deployment (Recommended)

### 1. Install Vercel CLI

```bash
npm i -g vercel
```

### 2. Deploy to Vercel

```bash
# Login to Vercel
vercel login

# Deploy the project
vercel
```

Follow the prompts:
- **Set up and deploy?** → Yes
- **Which scope?** → Select your account
- **Link to existing project?** → No
- **Project name?** → sparrow (or your preference)
- **Directory?** → `./`

### 3. Set Up Environment Variables

After deployment, add these environment variables via the [Vercel Dashboard](https://vercel.com/dashboard):

Go to: **Your Project → Settings → Environment Variables**

Add the following for **Production**, **Preview**, and **Development**:

```bash
# Database (get this from your PostgreSQL provider)
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require

# GROQ API (from https://console.groq.com)
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxx

# NextAuth (your production URL)
NEXTAUTH_URL=https://your-project.vercel.app

# NextAuth Secret (generate with: openssl rand -base64 32)
NEXTAUTH_SECRET=your-generated-secret-here

# Cron Secret (generate with: openssl rand -base64 32)
CRON_SECRET=your-cron-secret-here
```

### 4. Set Up Database

**Option A: Using Neon (Recommended)**

1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string (should include `?sslmode=require`)
4. Add it to Vercel environment variables as `DATABASE_URL`

**Option B: Using Supabase**

1. Sign up at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to **Settings → Database** and copy the connection string
4. Add it to Vercel environment variables as `DATABASE_URL`

### 5. Run Database Migrations

```bash
# Pull production environment variables locally
vercel env pull .env.production

# Set DATABASE_URL temporarily
export DATABASE_URL="your-production-database-url"

# Run migrations
npx prisma migrate deploy

# Seed the database with RSS feeds
npx prisma db seed
```

### 6. Redeploy with All Variables

```bash
vercel --prod
```

---

## Verify Deployment

### Check Your App

```bash
# Open your deployed app
vercel open
```

### Test These URLs

1. **Landing Page**: `https://your-project.vercel.app`
2. **Sign Up**: `https://your-project.vercel.app/auth/signup`
3. **Dashboard**: `https://your-project.vercel.app/dashboard`

### Verify Cron Job

1. Go to Vercel Dashboard → Your Project → **Cron**
2. You should see: `/api/cron/daily-tasks` scheduled for `0 0 * * *` (daily at midnight UTC)
3. You can manually trigger it for testing

---

## How the Daily Cron Works

The system runs **once per day at midnight UTC** and performs three tasks:

### 1. RSS Feed Ingestion (Step 1)
- Fetches all active RSS feeds
- Deduplicates content
- Stores new articles in database
- Updates feed metadata

### 2. AI Content Processing (Step 2)
- Processes up to **50 articles per day** with GROQ AI
- Analyzes quality, generates summaries
- Optimizes titles for engagement
- Scores content (quality + engagement)

### 3. Auto-Posting (Step 3)
- Finds users with auto-posting enabled
- Selects 6 unique, high-quality posts per platform
- Generates platform-specific content
- Posts to social media (when integrated)
- Tracks posted content to prevent duplicates

**Total Runtime:** ~2-5 minutes depending on content volume

---

## Rate Limit Configuration

The system respects all free tier limits:

| Service   | Free Tier Limit      | Sparrow Config       | Daily Capacity |
|-----------|---------------------|---------------------|----------------|
| GROQ AI   | 30 req/min          | 25 req/min          | 14,400/day     |
| Twitter   | 50 tweets/day       | 50 tweets/day       | 50/day         |
| LinkedIn  | 100 posts/day       | 80 posts/day        | 80/day         |
| Facebook  | 200 posts/hour      | 150 posts/hour      | 3,600/day      |
| RSS Feeds | No official limit   | 100 feeds/hour      | Unlimited      |

**Note:** Social media posting requires additional API keys (not needed for testing)

---

## Post-Deployment Setup

### 1. Create Your First User

```bash
# Visit your app
https://your-project.vercel.app/auth/signup

# Register with email and password
# Login and access dashboard
```

### 2. Configure User Preferences

1. Go to **Settings** in the dashboard
2. Select your topics of interest (Technology, Business, Science, etc.)
3. Choose platforms for auto-posting (optional, requires social accounts)
4. Save preferences

### 3. RSS Feeds

The system comes pre-seeded with 15+ high-quality RSS feeds:
- TechCrunch, The Verge, Wired (Technology)
- Harvard Business Review, Forbes (Business)
- ScienceDaily, NASA, National Geographic (Science)
- The Atlantic, Medium (General)

### 4. Monitor System

- **Dashboard**: View content, drafts, analytics
- **Rate Limit Monitor**: Check API usage in real-time (sidebar)
- **Vercel Logs**: Monitor cron job execution

---

## Troubleshooting

### Issue: Database Connection Failed

**Solution:**
- Ensure `DATABASE_URL` includes `?sslmode=require`
- Check database allows connections from `0.0.0.0/0` (all IPs)
- Verify database is not in sleep mode (some free tiers pause)

### Issue: Cron Job Not Running

**Solution:**
- Cron jobs on Vercel free tier run **daily only**
- Check **Vercel Dashboard → Cron** for execution logs
- Manually trigger via dashboard to test
- Verify `CRON_SECRET` is set correctly

### Issue: GROQ API Rate Limit Exceeded

**Solution:**
- Rate limiter is configured for 25 req/min (under 30/min limit)
- Daily processing limited to 50 items
- Check rate limit monitor in dashboard
- Reduce `processUnprocessedContent(50)` to lower number if needed

### Issue: Build Fails on Vercel

**Solution:**
```bash
# Test build locally first
npm run build

# Check for TypeScript errors
npm run type-check

# Ensure all dependencies are in package.json
npm install
```

### Issue: NextAuth Errors

**Solution:**
- Verify `NEXTAUTH_URL` matches production URL exactly
- Ensure `NEXTAUTH_SECRET` is at least 32 characters
- No trailing slashes in `NEXTAUTH_URL`

---

## Useful Commands

```bash
# View deployment logs
vercel logs

# View real-time production logs
vercel logs --follow

# List all deployments
vercel ls

# Pull environment variables locally
vercel env pull

# Manually trigger cron (for testing)
# Via Vercel Dashboard → Cron → Trigger

# Check project details
vercel inspect
```

---

## Upgrading to Pro Plan

If you need more features, upgrade to Vercel Pro ($20/month):

**Additional features:**
- Multiple cron jobs (unlimited)
- Faster edge functions
- More bandwidth
- Priority support

To upgrade: Vercel Dashboard → Settings → Upgrade

However, **most users won't need Pro** - the free tier works great for personal projects and small teams!

---

## Free Tier Limits Summary

**Vercel Hobby (Free) Plan:**
- ✅ 100 GB bandwidth/month
- ✅ 100 GB-hours serverless function execution
- ✅ 1 cron job (daily) - **Already configured!**
- ✅ Unlimited deployments
- ✅ HTTPS + custom domains

**Recommended Database (Neon Free):**
- ✅ 10 GB storage
- ✅ Unlimited compute hours
- ✅ 1 project
- ✅ Automatic backups

**GROQ API (Free):**
- ✅ 30 requests/minute
- ✅ 14,400 requests/day
- ✅ Fast inference (Mixtral-8x7b)

---

## Cost Estimate

**Total Monthly Cost: $0** 🎉

- Vercel Hobby: **Free**
- Neon Database: **Free**
- GROQ API: **Free**
- Domain (optional): ~$12/year

---

## Next Steps

1. ✅ Deploy to Vercel
2. ✅ Set up database
3. ✅ Configure environment variables
4. ✅ Run migrations
5. ✅ Create user account
6. ✅ Configure preferences
7. ⏰ Wait for midnight UTC for first cron run!
8. 📊 Check dashboard next morning

---

## Support

- **Vercel Docs**: https://vercel.com/docs
- **GROQ Docs**: https://console.groq.com/docs
- **Prisma Docs**: https://www.prisma.io/docs
- **Next.js Docs**: https://nextjs.org/docs

---

**Happy deploying! 🚀**
