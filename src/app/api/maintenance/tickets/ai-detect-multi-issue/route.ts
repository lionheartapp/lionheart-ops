/**
 * POST /api/maintenance/tickets/ai-detect-multi-issue — AI multi-issue detection
 *
 * Analyzes ticket title/description/category to detect if multiple distinct
 * maintenance issues are described. Returns a suggestion to split into 2 tickets.
 * Gracefully degrades to { hasMultipleIssues: false } on any failure.
 *
 * Migrated from Google Gemini to Anthropic Claude.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { claudeTextCompletion, extractJson, getClaudeClient } from '@/lib/services/ai/claude-client'

function buildPrompt(title: string, description: string, category: string): string {
  return `You are analyzing a school maintenance request to determine if it describes multiple distinct maintenance issues.

Ticket title: ${title}
Category: ${category}
Description: ${description || 'No description provided'}

Your task:
1. Determine if this ticket describes TWO OR MORE distinct maintenance issues (e.g., "The sink is leaking AND the ceiling light is flickering")
2. If yes, identify what the second issue is and suggest an appropriate title and category for it

Valid categories: ELECTRICAL, PLUMBING, HVAC, STRUCTURAL, CUSTODIAL_BIOHAZARD, IT_AV, GROUNDS, OTHER

Respond with a JSON object in this exact format (no markdown, no code blocks):
{
  "hasMultipleIssues": true or false,
  "secondIssue": {
    "title": "Suggested title for the second ticket",
    "suggestedCategory": "CATEGORY_NAME"
  }
}

If hasMultipleIssues is false, omit the secondIssue field entirely.
Only flag as multiple issues if they are clearly distinct problems requiring separate work orders.`
}

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.MAINTENANCE_SUBMIT)

    if (!getClaudeClient()) {
      return NextResponse.json(ok({ hasMultipleIssues: false }))
    }

    const body = await req.json()
    const { title, description, category } = body

    if (!title || !category) {
      return NextResponse.json(ok({ hasMultipleIssues: false }))
    }

    try {
      const prompt = buildPrompt(
        String(title),
        String(description || ''),
        String(category)
      )

      const result = await claudeTextCompletion(prompt)
      if (!result) {
        return NextResponse.json(ok({ hasMultipleIssues: false }))
      }

      const parsed = extractJson<{ hasMultipleIssues?: boolean; secondIssue?: { title?: string; suggestedCategory?: string } }>(result)

      // Validate response structure
      if (!parsed || typeof parsed.hasMultipleIssues !== 'boolean') {
        return NextResponse.json(ok({ hasMultipleIssues: false }))
      }

      const validCategories = [
        'ELECTRICAL', 'PLUMBING', 'HVAC', 'STRUCTURAL',
        'CUSTODIAL_BIOHAZARD', 'IT_AV', 'GROUNDS', 'OTHER',
      ]

      if (parsed.hasMultipleIssues && parsed.secondIssue) {
        const category = parsed.secondIssue.suggestedCategory?.toUpperCase()
        return NextResponse.json(ok({
          hasMultipleIssues: true,
          secondIssue: {
            title: String(parsed.secondIssue.title || '').trim(),
            suggestedCategory: validCategories.includes(category || '') ? category : 'OTHER',
          },
        }))
      }

      return NextResponse.json(ok({ hasMultipleIssues: false }))
    } catch (aiError) {
      console.error('[ai-detect-multi-issue] Claude error (graceful degrade):', aiError)
      return NextResponse.json(ok({ hasMultipleIssues: false }))
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    // Always degrade gracefully for AI endpoints
    console.error('[POST /api/maintenance/tickets/ai-detect-multi-issue]', error)
    return NextResponse.json(ok({ hasMultipleIssues: false }))
  }
}
