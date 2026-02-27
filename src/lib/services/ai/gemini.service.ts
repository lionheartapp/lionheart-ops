import { GoogleGenAI } from '@google/genai'

export class GeminiService {
  private client: GoogleGenAI | null

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY
    this.client = apiKey ? new GoogleGenAI({ apiKey }) : null
  }

  async patchDraftFromText(input: string) {
    if (!this.client) {
      return {
        summary: input,
        hints: ['Set GEMINI_API_KEY to enable semantic patching'],
      }
    }

    const prompt = `Extract structured event hints from this school operations request: ${input}`
    const result = await this.client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    })

    return {
      summary: result.text || input,
      hints: ['AI patch generated'],
    }
  }
}

export const geminiService = new GeminiService()
