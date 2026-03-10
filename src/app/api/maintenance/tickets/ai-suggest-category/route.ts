/**
 * POST /api/maintenance/tickets/ai-suggest-category — AI image classification
 *
 * Accepts an image (base64 or URL) and returns a suggested MaintenanceCategory.
 * Gracefully degrades to null if AI fails or API key is not set.
 *
 * Migrated from Google Gemini to Anthropic Claude.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { claudeVisionCompletion, getClaudeClient } from '@/lib/services/ai/claude-client'

const CATEGORY_PROMPT = `You are a maintenance category classifier for a school facility management system.

Analyze the provided image and classify the maintenance issue into exactly one of these categories:
- ELECTRICAL (lighting, outlets, wiring, panels, switches)
- PLUMBING (leaks, drains, toilets, sinks, pipes, water)
- HVAC (heating, cooling, ventilation, air conditioning, thermostats)
- STRUCTURAL (walls, floors, ceilings, doors, windows, roofing)
- CUSTODIAL_BIOHAZARD (spills, mold, pests, biohazards, deep cleaning)
- IT_AV (computers, projectors, audio/visual equipment, network, cables)
- GROUNDS (outdoor areas, landscaping, parking lots, athletic fields)
- OTHER (anything that does not clearly fit the above)

Respond with ONLY the category name in uppercase, nothing else.
If you cannot determine the category from the image, respond with: OTHER`

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.MAINTENANCE_SUBMIT)

    if (!getClaudeClient()) {
      return NextResponse.json(ok({ suggestedCategory: null }))
    }

    const body = await req.json()
    const { imageBase64, imageUrl, contentType } = body

    if (!imageBase64 && !imageUrl) {
      return NextResponse.json(ok({ suggestedCategory: null }))
    }

    try {
      let images: Array<{ type: 'base64'; data: string; mediaType: string } | { type: 'url'; url: string }>

      if (imageBase64) {
        const base64Data = imageBase64.replace(/^data:[^;]+;base64,/, '')
        images = [{ type: 'base64', data: base64Data, mediaType: contentType || 'image/jpeg' }]
      } else {
        images = [{ type: 'url', url: imageUrl }]
      }

      const result = await claudeVisionCompletion(CATEGORY_PROMPT, images)

      const text = (result || '').trim().toUpperCase()
      const validCategories = [
        'ELECTRICAL', 'PLUMBING', 'HVAC', 'STRUCTURAL',
        'CUSTODIAL_BIOHAZARD', 'IT_AV', 'GROUNDS', 'OTHER',
      ]

      const suggestedCategory = validCategories.includes(text) ? text : null
      return NextResponse.json(ok({ suggestedCategory }))
    } catch (aiError) {
      console.error('[ai-suggest-category] Claude error (graceful degrade):', aiError)
      return NextResponse.json(ok({ suggestedCategory: null }))
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    // Always degrade gracefully for AI endpoints
    console.error('[POST /api/maintenance/tickets/ai-suggest-category]', error)
    return NextResponse.json(ok({ suggestedCategory: null }))
  }
}
