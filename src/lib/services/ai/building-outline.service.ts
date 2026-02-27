import { GoogleGenAI } from '@google/genai'

interface PixelCoord {
  x: number
  y: number
}

interface DetectionResult {
  found: boolean
  confidence: number
  pixelCoordinates: PixelCoord[]
  description: string
}

export class BuildingOutlineService {
  private client: GoogleGenAI | null

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY
    this.client = apiKey ? new GoogleGenAI({ apiKey }) : null
  }

  /**
   * Detect the building outline from a satellite tile image.
   * Returns pixel coordinates (relative to the tile image) of the building perimeter.
   */
  async detectBuildingOutline(
    imageBase64: string,
    buildingName: string,
    imageWidth: number = 512,
    imageHeight: number = 512
  ): Promise<PixelCoord[] | null> {
    if (!this.client) return null

    const prompt = `You are analyzing a satellite/aerial image of a campus. The image is ${imageWidth}x${imageHeight} pixels.

There is a building called "${buildingName}" near the center of this image.

Your task: Identify the outline (perimeter/footprint) of this building and return the polygon coordinates as pixel positions within the image.

Return ONLY valid JSON with this exact structure (no markdown fences, no commentary):
{
  "found": true,
  "confidence": 0.85,
  "pixelCoordinates": [
    {"x": 120, "y": 80},
    {"x": 350, "y": 80},
    {"x": 350, "y": 320},
    {"x": 120, "y": 320}
  ],
  "description": "Rectangular building with dark roof"
}

Rules:
- Look for the most prominent building structure near the center of the image
- Trace the roofline/footprint outline of just that building
- Provide 4-12 vertex points following the actual shape (not just a rectangle unless it IS rectangular)
- Coordinates must be within 0-${imageWidth} for x and 0-${imageHeight} for y
- Points should go clockwise around the building perimeter
- If you cannot identify a clear building, set "found" to false and return empty pixelCoordinates
- Only detect one building — the main one nearest the center`

    try {
      const result = await this.client.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: imageBase64,
                },
              },
              { text: prompt },
            ],
          },
        ],
      })

      const text = (result.text || '').trim()

      // Strip markdown fences if present
      const jsonStr = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')

      const parsed: DetectionResult = JSON.parse(jsonStr)

      if (!parsed.found || !parsed.pixelCoordinates?.length || parsed.pixelCoordinates.length < 3) {
        console.log('[OUTLINE] Building not detected or insufficient points:', parsed.description)
        return null
      }

      // Validate coordinates are within bounds
      const valid = parsed.pixelCoordinates.every(
        (p) => p.x >= 0 && p.x <= imageWidth && p.y >= 0 && p.y <= imageHeight
      )
      if (!valid) {
        console.warn('[OUTLINE] Some coordinates out of bounds, attempting to clamp')
        parsed.pixelCoordinates = parsed.pixelCoordinates.map((p) => ({
          x: Math.max(0, Math.min(imageWidth, p.x)),
          y: Math.max(0, Math.min(imageHeight, p.y)),
        }))
      }

      console.log(
        `[OUTLINE] Detected "${buildingName}" with ${parsed.pixelCoordinates.length} points, confidence: ${parsed.confidence}`
      )

      return parsed.pixelCoordinates
    } catch (error) {
      console.error('[OUTLINE] Gemini detection failed:', error)
      return null
    }
  }
}

export const buildingOutlineService = new BuildingOutlineService()
