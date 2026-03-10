/**
 * Building Outline Detection Service — Anthropic Claude Vision
 *
 * Detects building rooflines from satellite/aerial imagery using Claude's
 * vision capabilities. Returns pixel coordinates for map polygon overlay.
 *
 * Migrated from Google Gemini to Anthropic Claude.
 */

import { claudeVisionCompletion, extractJson } from './claude-client'

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
    const prompt = `You are a computer vision expert specializing in building footprint extraction from satellite imagery.

IMAGE: A ${imageWidth}x${imageHeight} pixel satellite/aerial image. The building "${buildingName}" should be near the center.

TASK: Identify and precisely trace the roofline outline (footprint polygon) of the most prominent building structure nearest to the center of the image.

IDENTIFICATION TIPS:
- Buildings typically appear as rectangular or L-shaped structures with uniform coloring (gray, brown, white, or dark rooftops)
- Look for sharp edges and straight lines that contrast with surrounding terrain
- The building roof will have consistent color/texture distinct from surrounding grass, pavement, or shadows
- Shadows often appear on one side of the building and can help identify edges
- Ignore roads, parking lots, sports fields, and vegetation

TRACING RULES:
- Trace the OUTER EDGE of the roofline precisely
- Follow the actual shape: if the building is L-shaped, T-shaped, or has wings, include all sections
- Use 6-20 vertex points to accurately capture the shape
- More vertices for complex shapes, fewer for simple rectangles
- Go CLOCKWISE around the perimeter starting from the top-left corner
- All x coordinates must be between 0 and ${imageWidth}
- All y coordinates must be between 0 and ${imageHeight}
- Place vertices at CORNERS where the roofline changes direction
- For curved sections, approximate with multiple closely-spaced points

Return ONLY valid JSON (no markdown fences, no extra text):
{
  "found": true,
  "confidence": 0.85,
  "pixelCoordinates": [
    {"x": 100, "y": 50},
    {"x": 200, "y": 50},
    {"x": 200, "y": 150},
    {"x": 100, "y": 150}
  ],
  "description": "Large rectangular building with dark gray roof"
}

If no clear building is visible near center, return: {"found": false, "confidence": 0, "pixelCoordinates": [], "description": "reason"}`

    try {
      const result = await claudeVisionCompletion(
        prompt,
        [{ type: 'base64', data: imageBase64, mediaType: 'image/png' }],
        1024
      )

      if (!result) {
        console.error('[OUTLINE] No response from Claude')
        return null
      }

      const parsed = extractJson<DetectionResult>(result)

      if (!parsed) {
        console.error('[OUTLINE] Failed to parse JSON response. Raw text:', result)
        return null
      }

      // Even if 'found' is false, return coordinates if we have 3+ points
      // Sometimes the model sets found:false even when it detects something
      if (!parsed.pixelCoordinates?.length || parsed.pixelCoordinates.length < 3) {
        console.log('[OUTLINE] Building detection has insufficient points (<3). Found flag:', parsed.found, 'Description:', parsed.description)
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
      console.error('[OUTLINE] Claude detection failed:', error)
      return null
    }
  }
}

export const buildingOutlineService = new BuildingOutlineService()
