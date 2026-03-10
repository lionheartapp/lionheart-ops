/**
 * Shared Claude AI Client
 *
 * Centralized Anthropic SDK client for all AI features.
 * Uses ANTHROPIC_API_KEY from environment.
 * Returns null when API key is not configured (graceful degradation).
 */

import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-4-5-20250929'

export { MODEL }

export function getClaudeClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) return null
  return new Anthropic({ apiKey })
}

/**
 * Send a text-only prompt to Claude and get the response text.
 * Returns null on any failure.
 */
export async function claudeTextCompletion(prompt: string, maxTokens = 1024): Promise<string | null> {
  const client = getClaudeClient()
  if (!client) return null

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    })

    const textContent = response.content.find((block) => block.type === 'text')
    if (!textContent || textContent.type !== 'text') return null

    return textContent.text.trim() || null
  } catch (error) {
    console.error('[claude-client] Text completion error:', error)
    return null
  }
}

/**
 * Send a vision prompt (text + images) to Claude and get the response text.
 * Supports both base64 and URL-based images.
 * Returns null on any failure.
 */
export async function claudeVisionCompletion(
  prompt: string,
  images: Array<{ type: 'base64'; data: string; mediaType: string } | { type: 'url'; url: string }>,
  maxTokens = 1024
): Promise<string | null> {
  const client = getClaudeClient()
  if (!client) return null

  try {
    const imageBlocks: Anthropic.ContentBlockParam[] = images.map((img) => {
      if (img.type === 'base64') {
        return {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: img.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: img.data,
          },
        }
      }
      return {
        type: 'image' as const,
        source: {
          type: 'url' as const,
          url: img.url,
        },
      }
    })

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [
        {
          role: 'user',
          content: [...imageBlocks, { type: 'text', text: prompt }],
        },
      ],
    })

    const textContent = response.content.find((block) => block.type === 'text')
    if (!textContent || textContent.type !== 'text') return null

    return textContent.text.trim() || null
  } catch (error) {
    console.error('[claude-client] Vision completion error:', error)
    return null
  }
}

/**
 * Extract JSON from an AI response string.
 * Handles markdown code fences and finds the first valid JSON object.
 */
export function extractJson<T = unknown>(text: string): T | null {
  // Strip markdown code fences
  let cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

  // Find first { to last }
  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')

  if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) return null

  try {
    return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1)) as T
  } catch {
    return null
  }
}
