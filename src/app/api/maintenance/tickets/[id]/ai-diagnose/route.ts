/**
 * POST /api/maintenance/tickets/[id]/ai-diagnose
 *
 * Returns an AI-powered diagnosis of the ticket's photos.
 *
 * Behavior:
 *   - Gracefully degrades if GEMINI_API_KEY is not set
 *   - Returns cached diagnosis if photos haven't changed since last analysis
 *   - Calls Google Gemini Vision API and caches result in aiAnalysis field
 *   - Adding new photos (changing photos array) invalidates the cache
 *
 * Required permission: MAINTENANCE_CLAIM (technicians and heads can use AI)
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { analyzeMaintenancePhotos } from '@/lib/services/ai/maintenance-ai.service'
import type { AiAnalysisCache } from '@/lib/types/maintenance-ai'

export const POST = withAuth(async ({ params }) => {
  // Graceful degrade — API key not configured
  if (!(process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY)?.trim()) {
    return NextResponse.json(ok({ available: false, diagnosis: null, cached: false }))
  }

  const ticket = await prisma.maintenanceTicket.findUnique({
    where: { id: params.id },
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

  // Call Gemini API
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
    where: { id: params.id },
    data: { aiAnalysis: updatedCache as unknown as object },
  })

  return NextResponse.json(ok({ available: true, diagnosis, cached: false }))
}, { permission: PERMISSIONS.MAINTENANCE_CLAIM })
