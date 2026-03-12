import { GoogleGenAI } from '@google/genai'
import { rawPrisma } from '@/lib/db'

/**
 * Parses a free-text A/V requirements description into a structured equipment list
 * using Gemini AI, then saves the result back to the Event record.
 *
 * This is a fire-and-forget async function — it never throws or blocks the caller.
 * The result is written directly to avEquipmentList on the Event row.
 *
 * Example output: [{ "item": "Projector", "quantity": 1 }, { "item": "Wireless Mic", "quantity": 2 }]
 */
export async function parseAVRequirementsAsync(
  eventId: string,
  requirementsText: string
): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return // Silently skip if Gemini is not configured

  try {
    const genAI = new GoogleGenAI({ apiKey })

    const prompt = `You are an A/V equipment coordinator. Parse the following event A/V request into a structured JSON array of equipment items needed.

Format: [{ "item": "equipment name", "quantity": number }]

Rules:
- Each object must have "item" (string) and "quantity" (number, default 1 if unspecified)
- Combine duplicates (e.g. "2 mics and 1 mic" → quantity 3)
- Use clean, standard equipment names (e.g. "Wireless Microphone", "Projector", "HDMI Cable", "Speaker", "Laptop", "Podium Microphone", "Livestream Setup")
- Return ONLY the JSON array, no other text, no markdown, no explanation

Request: "${requirementsText.replace(/"/g, '\\"')}"

JSON:`

    const result = await genAI.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    })

    const responseText = result.text ?? '[]'
    // Extract the JSON array from the response (handles cases where model adds extra text)
    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    const equipmentList = jsonMatch ? JSON.parse(jsonMatch[0]) : []

    // Validate basic structure before saving
    const validList = Array.isArray(equipmentList)
      ? equipmentList.filter(
          (e) => e && typeof e.item === 'string' && typeof e.quantity === 'number'
        )
      : []

    await rawPrisma.event.update({
      where: { id: eventId },
      data: { avEquipmentList: validList } as any, // avEquipmentList added via SQL; Prisma types not yet regenerated
    })
  } catch (err) {
    // Always silent — never block event creation due to AI parsing failure
    console.error(`[AV Parser] Failed to parse requirements for event ${eventId}:`, err)
  }
}
