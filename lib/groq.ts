import Groq from 'groq-sdk'
import { withRateLimit } from './services/rate-limiter'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

export interface ContentAnalysis {
  qualityScore: number
  optimizedTitle: string
  summary: string
  suggestedTags: string[]
  engagementScore: number
}

export async function analyzeContent(
  title: string,
  content: string,
  categories: string[]
): Promise<ContentAnalysis> {
  try {
    const prompt = `Analyze the following content and provide:
1. A quality score (0-100) based on clarity, relevance, and depth
2. An optimized, engaging title (max 100 chars)
3. A concise summary (max 200 chars)
4. 3-5 relevant tags
5. An engagement prediction score (0-100) based on likely social media performance

Title: ${title}
Content: ${content.substring(0, 1000)}
Categories: ${categories.join(', ')}

Respond in JSON format:
{
  "qualityScore": number,
  "optimizedTitle": string,
  "summary": string,
  "suggestedTags": string[],
  "engagementScore": number
}`

    // Use rate limiting for GROQ API
    const completion = await withRateLimit('groq', async () => {
      return await groq.chat.completions.create({
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        model: 'mixtral-8x7b-32768',
        temperature: 0.5,
        max_tokens: 1024,
        response_format: { type: 'json_object' },
      })
    }, {
      retries: 2,
      onRetry: (attempt, error) => {
        console.log(`[GROQ] Retrying content analysis (attempt ${attempt + 1}):`, error.message)
      }
    })

    const result = JSON.parse(completion.choices[0]?.message?.content || '{}')
    return result as ContentAnalysis
  } catch (error) {
    console.error('Error analyzing content with GROQ:', error)
    // Return default values if analysis fails
    return {
      qualityScore: 50,
      optimizedTitle: title,
      summary: content.substring(0, 200),
      suggestedTags: categories,
      engagementScore: 50,
    }
  }
}

export async function generateDraft(
  title: string,
  content: string,
  platform: string
): Promise<string> {
  try {
    const characterLimits: Record<string, number> = {
      twitter: 280,
      linkedin: 3000,
      facebook: 63206,
    }

    const limit = characterLimits[platform] || 280

    const prompt = `Create an engaging social media post for ${platform} based on this content:

Title: ${title}
Content: ${content.substring(0, 500)}

Requirements:
- Maximum ${limit} characters
- Include relevant hashtags
- Make it engaging and shareable
- Maintain professional tone
- Add a call-to-action if appropriate

Return only the post text, no additional formatting or explanation.`

    // Use rate limiting for GROQ API
    const completion = await withRateLimit('groq', async () => {
      return await groq.chat.completions.create({
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        model: 'mixtral-8x7b-32768',
        temperature: 0.7,
        max_tokens: 512,
      })
    }, {
      retries: 2,
      onRetry: (attempt, error) => {
        console.log(`[GROQ] Retrying draft generation (attempt ${attempt + 1}):`, error.message)
      }
    })

    return completion.choices[0]?.message?.content || ''
  } catch (error) {
    console.error('Error generating draft with GROQ:', error)
    return `${title}\n\n${content.substring(0, limit - title.length - 10)}...`
  }
}
