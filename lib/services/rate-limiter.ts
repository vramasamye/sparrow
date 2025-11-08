import { RateLimitConfig, ServiceName, getRateLimitConfig } from '@/lib/config/rate-limits'
import { prisma } from '@/lib/db'

/**
 * Token Bucket Rate Limiter Implementation
 * Uses in-memory token buckets with persistent tracking in database
 */

interface TokenBucket {
  tokens: number
  lastRefill: number
  queue: Array<{
    resolve: (value: boolean) => void
    reject: (error: Error) => void
    timestamp: number
  }>
}

// In-memory token buckets for each service
const buckets = new Map<string, TokenBucket>()

// Track concurrent requests per service
const concurrentRequests = new Map<string, number>()

/**
 * Initialize or get token bucket for a service
 */
function getTokenBucket(service: ServiceName): TokenBucket {
  const key = `${service}`

  if (!buckets.has(key)) {
    const config = getRateLimitConfig(service)
    buckets.set(key, {
      tokens: config.maxRequests,
      lastRefill: Date.now(),
      queue: [],
    })
  }

  return buckets.get(key)!
}

/**
 * Refill tokens based on time elapsed
 */
function refillTokens(service: ServiceName, bucket: TokenBucket): void {
  const config = getRateLimitConfig(service)
  const now = Date.now()
  const timePassed = now - bucket.lastRefill

  if (timePassed >= config.windowMs) {
    // Full refill
    bucket.tokens = config.maxRequests
    bucket.lastRefill = now
  } else {
    // Partial refill based on time passed
    const tokensToAdd = (timePassed / config.windowMs) * config.maxRequests
    bucket.tokens = Math.min(config.maxRequests, bucket.tokens + tokensToAdd)
    bucket.lastRefill = now
  }
}

/**
 * Check if we can make a request (respecting concurrent limit)
 */
function canMakeRequest(service: ServiceName): boolean {
  const config = getRateLimitConfig(service)
  const bucket = getTokenBucket(service)

  refillTokens(service, bucket)

  // Check token availability
  if (bucket.tokens < 1) {
    return false
  }

  // Check concurrent limit
  if (config.maxConcurrent) {
    const concurrent = concurrentRequests.get(service) || 0
    if (concurrent >= config.maxConcurrent) {
      return false
    }
  }

  return true
}

/**
 * Acquire a token to make a request
 */
async function acquireToken(service: ServiceName): Promise<boolean> {
  const config = getRateLimitConfig(service)
  const bucket = getTokenBucket(service)

  refillTokens(service, bucket)

  if (canMakeRequest(service)) {
    bucket.tokens -= 1

    // Increment concurrent requests
    const concurrent = concurrentRequests.get(service) || 0
    concurrentRequests.set(service, concurrent + 1)

    // Track in database for monitoring
    await trackRateLimitUsage(service)

    return true
  }

  // Wait in queue if configured
  if (config.cooldownMs) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = bucket.queue.findIndex((item) => item.resolve === resolve)
        if (index !== -1) {
          bucket.queue.splice(index, 1)
        }
        reject(new Error(`Rate limit timeout for ${service}`))
      }, config.cooldownMs! * 10) // Wait up to 10x cooldown

      bucket.queue.push({
        resolve: (value) => {
          clearTimeout(timeout)
          resolve(value)
        },
        reject: (error) => {
          clearTimeout(timeout)
          reject(error)
        },
        timestamp: Date.now(),
      })

      // Process queue after cooldown
      setTimeout(() => processQueue(service), config.cooldownMs!)
    })
  }

  return false
}

/**
 * Release a token after request completion
 */
function releaseToken(service: ServiceName): void {
  const concurrent = concurrentRequests.get(service) || 0
  concurrentRequests.set(service, Math.max(0, concurrent - 1))

  // Process next in queue
  processQueue(service)
}

/**
 * Process waiting queue
 */
async function processQueue(service: ServiceName): Promise<void> {
  const bucket = getTokenBucket(service)

  while (bucket.queue.length > 0 && canMakeRequest(service)) {
    const item = bucket.queue.shift()
    if (item) {
      bucket.tokens -= 1
      const concurrent = concurrentRequests.get(service) || 0
      concurrentRequests.set(service, concurrent + 1)
      await trackRateLimitUsage(service)
      item.resolve(true)
    }
  }
}

/**
 * Track rate limit usage in database for monitoring
 */
async function trackRateLimitUsage(service: string): Promise<void> {
  try {
    // We'll create a RateLimitLog model for this
    // For now, just log to console in production
    if (process.env.NODE_ENV === 'production') {
      console.log(`[RateLimit] ${service} - Token acquired at ${new Date().toISOString()}`)
    }
  } catch (error) {
    console.error('Error tracking rate limit:', error)
  }
}

/**
 * Exponential backoff helper
 */
async function exponentialBackoff(
  attempt: number,
  baseMs: number,
  maxMs: number
): Promise<void> {
  const delay = Math.min(baseMs * Math.pow(2, attempt), maxMs)
  const jitter = Math.random() * 0.3 * delay // Add 0-30% jitter
  await new Promise((resolve) => setTimeout(resolve, delay + jitter))
}

/**
 * Execute a function with rate limiting
 */
export async function withRateLimit<T>(
  service: ServiceName,
  fn: () => Promise<T>,
  options: {
    retries?: number
    onRetry?: (attempt: number, error: Error) => void
  } = {}
): Promise<T> {
  const config = getRateLimitConfig(service)
  const maxRetries = options.retries ?? 3

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Acquire token
      const acquired = await acquireToken(service)

      if (!acquired) {
        throw new Error(`Failed to acquire rate limit token for ${service}`)
      }

      try {
        // Execute function
        const result = await fn()
        return result
      } finally {
        // Release token
        releaseToken(service)

        // Respect cooldown
        if (config.cooldownMs) {
          await new Promise((resolve) => setTimeout(resolve, config.cooldownMs!))
        }
      }
    } catch (error: any) {
      // Check if it's a rate limit error
      const isRateLimitError =
        error.message?.includes('rate limit') ||
        error.message?.includes('429') ||
        error.status === 429

      if (isRateLimitError && attempt < maxRetries && config.useBackoff) {
        // Call retry callback
        if (options.onRetry) {
          options.onRetry(attempt, error)
        }

        // Exponential backoff
        await exponentialBackoff(
          attempt,
          config.backoffMs || 1000,
          config.maxBackoffMs || 30000
        )

        console.log(
          `[RateLimit] Retrying ${service} after rate limit (attempt ${attempt + 1}/${maxRetries})`
        )
        continue
      }

      // Re-throw if not a rate limit error or out of retries
      throw error
    }
  }

  throw new Error(`Max retries exceeded for ${service}`)
}

/**
 * Batch execute functions with rate limiting
 */
export async function batchWithRateLimit<T>(
  service: ServiceName,
  items: T[],
  fn: (item: T) => Promise<any>,
  options: {
    batchSize?: number
    delayBetweenBatches?: number
    onProgress?: (completed: number, total: number) => void
  } = {}
): Promise<Array<{ success: boolean; result?: any; error?: Error }>> {
  const config = getRateLimitConfig(service)
  const batchSize = options.batchSize || config.maxConcurrent || 5
  const delay = options.delayBetweenBatches || config.cooldownMs || 1000

  const results: Array<{ success: boolean; result?: any; error?: Error }> = []

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)

    // Process batch in parallel
    const batchResults = await Promise.allSettled(
      batch.map((item) =>
        withRateLimit(service, () => fn(item), {
          retries: 2,
        })
      )
    )

    // Collect results
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push({ success: true, result: result.value })
      } else {
        results.push({ success: false, error: result.reason })
      }
    }

    // Progress callback
    if (options.onProgress) {
      options.onProgress(Math.min(i + batchSize, items.length), items.length)
    }

    // Delay between batches
    if (i + batchSize < items.length) {
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  return results
}

/**
 * Get current rate limit status for a service
 */
export function getRateLimitStatus(service: ServiceName): {
  availableTokens: number
  maxTokens: number
  concurrentRequests: number
  maxConcurrent: number
  queueLength: number
} {
  const config = getRateLimitConfig(service)
  const bucket = getTokenBucket(service)
  const concurrent = concurrentRequests.get(service) || 0

  refillTokens(service, bucket)

  return {
    availableTokens: Math.floor(bucket.tokens),
    maxTokens: config.maxRequests,
    concurrentRequests: concurrent,
    maxConcurrent: config.maxConcurrent || 0,
    queueLength: bucket.queue.length,
  }
}

/**
 * Reset rate limit for a service (useful for testing)
 */
export function resetRateLimit(service: ServiceName): void {
  buckets.delete(service)
  concurrentRequests.delete(service)
}

/**
 * Get all rate limit statuses
 */
export function getAllRateLimitStatuses(): Record<ServiceName, ReturnType<typeof getRateLimitStatus>> {
  const services: ServiceName[] = ['groq', 'twitter', 'linkedin', 'facebook', 'rss', 'newsapi']
  const statuses: any = {}

  for (const service of services) {
    statuses[service] = getRateLimitStatus(service)
  }

  return statuses
}
