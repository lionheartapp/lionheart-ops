/**
 * POST /api/maintenance/tickets/[id]/ai-diagnose
 *
 * Returns an AI-powered diagnosis of the ticket's photos.
 *
 * Behavior:
 *   - Gracefully degrades if ANTHROPIC_API_KEY is not set
 *   - Returns cached diagnosis if photos haven't changed since last analysis
 *   - Calls Anthropic Claude Vision API and caches result in aiAnalysis field
 *   - Adding new photos (changing photos array) invalidates the cache
 *
 * Required permission: MAINTENANCE_CLAIM (technicians and heads can use AI)
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { analyzeMaintenancePhotos } from '@/lib/services/ai/maintenance-ai.service'
import type { AiAnalysisCache } from '@/lib/types/maintenance-ai'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.MAINTENANCE_CLAIM)

    // Graceful degrade — API key not configured
    if (!process.env.ANTHROPIC_API_KEY?.trim()) {
      return NextResponse.json(ok({ available: false, diagnosis: null, cached: false }))
    }

    return await runWithOrgContext(orgId, async () => {
      const ticket = await prisma.maintenanceTicket.findUnique({
        where: { id },
        select: {
          id: true,
          photos: true,
          aiAnalysis: true,
          category: true,
          title: true,
          description: true,
        },
      })

      if (!ticket) {
        return NextResponse.json(fail('NOT_FOUND', 'Ticket not found'), { status: 404 })
      }

      // No photos — AI diagnosis is not possible
      if (!ticket.photos || ticket.photos.length === 0) {
        return NextResponse.json(ok({ available: true, diagnosis: null, cached: false, reason: 'no-photos' }))
      }

      // Check cache — return if photos haven't changed
      const cached = ticket.aiAnalysis as AiAnalysisCache | null
      if (cached?.diagnosis) {
        const currentSorted = [...ticket.photos].sort().join(',')
        const snapshotSorted = [...(cached.lastPhotoSnapshot ?? [])].sort().join(',')
        if (currentSorted === snapshotSorted) {
          return NextResponse.json(ok({ available: true, diagnosis: cached.diagnosis, cached: true }))
        }
      }

      // Call Anthropic API
      const diagnosis = await analyzeMaintenancePhotos({
        photoUrls: ticket.photos,
        category: ticket.category,
        title: ticket.title,
        description: ticket.description,
      })

      if (!diagnosis) {
        return NextResponse.json(ok({ available: true, diagnosis: null, cached: false, reason: 'ai-unavailable' }))
      }

      // Build updated cache — preserve existing conversation turns
      const updatedCache: AiAnalysisCache = {
        diagnosis,
        conversation: cached?.conversation ?? [],
        lastPhotoSnapshot: [...ticket.photos],
      }

      // Persist cache to DB
      await prisma.maintenanceTicket.update({
        where: { id },
        data: { aiAnalysis: updatedCache as unknown as object },
      })

      return NextResponse.json(ok({ available: true, diagnosis, cached: false }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[POST /api/maintenance/tickets/[id]/ai-diagnose]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
