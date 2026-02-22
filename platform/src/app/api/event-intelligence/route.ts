import { NextRequest, NextResponse } from 'next/server'
import { withOrg, getOrgId } from '../../../lib/orgContext'
import { verifyToken } from '../../../lib/auth'
import { corsHeaders } from '../../../lib/cors'
import { prismaBase } from '../../../lib/prisma'
import { analyzeEventIntelligence } from '../../lib/eventIntelligence'

/**
 * POST /api/event-intelligence
 * Analyze event for HVAC overrides, inventory issues, and setup windows
 */
export async function POST(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
      // Verify auth
      const authHeader = req.headers.get('authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401, headers: corsHeaders }
        )
      }

      const payload = await verifyToken(authHeader.slice(7))
      if (!payload?.userId) {
        return NextResponse.json(
          { error: 'Invalid token' },
          { status: 401, headers: corsHeaders }
        )
      }

      const orgId = getOrgId()
      const body = await req.json()

      const {
        event,
        buildingDivision,
      } = body

      if (!orgId) {
        return NextResponse.json(
          { error: 'Organization ID is required' },
          { status: 401, headers: corsHeaders }
        )
      }

      if (!event || !event.id || !event.date || !event.startTime || !event.name) {
        return NextResponse.json(
          { error: 'Missing required event fields' },
          { status: 400, headers: corsHeaders }
        )
      }

      // Analyze event
      const analysis = await analyzeEventIntelligence(
        event,
        orgId,
        buildingDivision || 'ELEMENTARY'
      )

      return NextResponse.json(analysis, { headers: corsHeaders })
    })
  } catch (err) {
    console.error('POST /api/event-intelligence error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to analyze event' },
      { status: 500, headers: corsHeaders }
    )
  }
}
