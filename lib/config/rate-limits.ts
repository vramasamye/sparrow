/**
 * Rate Limit Configuration for All External Services
 *
 * Each service has specific rate limits that we must respect to avoid:
 * - Account suspension
 * - API access revocation
 * - Service degradation
 */

export interface RateLimitConfig {
  /** Maximum requests allowed per time window */
  maxRequests: number
  /** Time window in milliseconds */
  windowMs: number
  /** Maximum concurrent requests */
  maxConcurrent?: number
  /** Cooldown period after hitting limit (ms) */
  cooldownMs?: number
  /** Whether to use exponential backoff */
  useBackoff?: boolean
  /** Initial backoff delay (ms) */
  backoffMs?: number
  /** Maximum backoff delay (ms) */
  maxBackoffMs?: number
}

/**
 * GROQ API Rate Limits
 * Free Tier: 30 requests per minute, 14,400 per day
 * Docs: https://console.groq.com/docs/rate-limits
 */
export const GROQ_RATE_LIMITS: RateLimitConfig = {
  maxRequests: 25, // Conservative: 25/min to stay under 30/min limit
  windowMs: 60 * 1000, // 1 minute
  maxConcurrent: 5, // Max 5 concurrent requests
  cooldownMs: 2000, // 2 second cooldown when approaching limit
  useBackoff: true,
  backoffMs: 1000, // Start with 1 second
  maxBackoffMs: 30000, // Max 30 seconds
}

/**
 * Twitter API Rate Limits
 * Free Tier: 1,500 tweets per month (v2 API)
 * Elevated: 3,000 tweets per month
 * Docs: https://developer.twitter.com/en/docs/twitter-api/rate-limits
 */
export const TWITTER_RATE_LIMITS: RateLimitConfig = {
  maxRequests: 50, // 50 tweets per day (conservative for free tier)
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  maxConcurrent: 2, // Only 2 concurrent tweet posts
  cooldownMs: 30000, // 30 second cooldown between tweets
  useBackoff: true,
  backoffMs: 2000,
  maxBackoffMs: 60000,
}

/**
 * LinkedIn API Rate Limits
 * Community Management API: 100 requests per day per member
 * Docs: https://learn.microsoft.com/en-us/linkedin/shared/api-guide/concepts/rate-limits
 */
export const LINKEDIN_RATE_LIMITS: RateLimitConfig = {
  maxRequests: 80, // Conservative: 80 per day
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  maxConcurrent: 3, // Max 3 concurrent posts
  cooldownMs: 60000, // 1 minute cooldown between posts
  useBackoff: true,
  backoffMs: 3000,
  maxBackoffMs: 120000,
}

/**
 * Facebook API Rate Limits
 * Graph API: 200 calls per hour per user
 * Docs: https://developers.facebook.com/docs/graph-api/overview/rate-limiting
 */
export const FACEBOOK_RATE_LIMITS: RateLimitConfig = {
  maxRequests: 150, // Conservative: 150 per hour
  windowMs: 60 * 60 * 1000, // 1 hour
  maxConcurrent: 5, // Max 5 concurrent posts
  cooldownMs: 5000, // 5 second cooldown
  useBackoff: true,
  backoffMs: 2000,
  maxBackoffMs: 60000,
}

/**
 * RSS Feed Fetching Rate Limits
 * Be respectful to feed providers
 */
export const RSS_RATE_LIMITS: RateLimitConfig = {
  maxRequests: 100, // Max 100 feeds per hour
  windowMs: 60 * 60 * 1000, // 1 hour
  maxConcurrent: 10, // Max 10 concurrent fetches
  cooldownMs: 1000, // 1 second between fetches
  useBackoff: true,
  backoffMs: 500,
  maxBackoffMs: 10000,
}

/**
 * NewsAPI Rate Limits
 * Free tier: 100 requests per day
 * Docs: https://newsapi.org/pricing
 */
export const NEWSAPI_RATE_LIMITS: RateLimitConfig = {
  maxRequests: 80, // Conservative: 80 per day
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  maxConcurrent: 2,
  cooldownMs: 2000,
  useBackoff: true,
  backoffMs: 1000,
  maxBackoffMs: 30000,
}

/**
 * Service-specific rate limit configurations
 */
export const RATE_LIMIT_CONFIGS = {
  groq: GROQ_RATE_LIMITS,
  twitter: TWITTER_RATE_LIMITS,
  linkedin: LINKEDIN_RATE_LIMITS,
  facebook: FACEBOOK_RATE_LIMITS,
  rss: RSS_RATE_LIMITS,
  newsapi: NEWSAPI_RATE_LIMITS,
} as const

export type ServiceName = keyof typeof RATE_LIMIT_CONFIGS

/**
 * Get rate limit config for a service
 */
export function getRateLimitConfig(service: ServiceName): RateLimitConfig {
  return RATE_LIMIT_CONFIGS[service]
}

/**
 * Calculate requests per second for a service
 */
export function getRequestsPerSecond(service: ServiceName): number {
  const config = getRateLimitConfig(service)
  return (config.maxRequests / config.windowMs) * 1000
}

/**
 * Get recommended batch size for a service
 */
export function getRecommendedBatchSize(service: ServiceName): number {
  const config = getRateLimitConfig(service)
  return Math.min(config.maxConcurrent || 5, Math.floor(config.maxRequests / 10))
}
