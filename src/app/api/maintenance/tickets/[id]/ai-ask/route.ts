/**
 * POST /api/maintenance/tickets/[id]/ai-ask
 *
 * Accepts a free-form question and returns an AI response in the context of
 * the maintenance ticket. Appends the conversation turn to the cached aiAnalysis.
 *
 * Behavior:
 *   - Gracefully degrades if GEMINI_API_KEY is not set
 *   - Loads existing conversation history from aiAnalysis cache
 *   - Sends conversation history + new question to Gemini
 *   - Appends user + assistant turns to cache and persists to DB
 *
 * Required permission: MAINTENANCE_CLAIM (technicians and heads can use AI)
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { askMaintenanceAI } from '@/lib/services/ai/maintenance-ai.service'
import type { AiAnalysisCache, AiConversationTurn } from '@/lib/types/maintenance-ai'
import { z } from 'zod'

const AskSchema = z.object({
  question: z.string().min(1, 'Question is required').max(1000, 'Question must be 1000 characters or fewer'),
})

export const POST = withAuth(async ({ req, params }) => {
  // Graceful degrade — API key not configured
  if (!(process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY)?.trim()) {
    return NextResponse.json(ok({ available: false, answer: null, conversation: [] }))
  }

  // Validate request body
  const body = await req.json()
  const parseResult = AskSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'Invalid request', parseResult.error.issues.map((e) => e.message)),
      { status: 400 }
    )
  }
  const { question } = parseResult.data

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

  // Load existing conversation
  const cached = ticket.aiAnalysis as AiAnalysisCache | null
  const conversationHistory: AiConversationTurn[] = cached?.conversation ?? []

  // Call Gemini API
  const answer = await askMaintenanceAI({
    question,
    ticketContext: {
      category: ticket.category,
      title: ticket.title,
      description: ticket.description,
      photos: ticket.photos,
    },
    conversationHistory,
  })

  if (!answer) {
    return NextResponse.json(ok({ available: true, answer: null, error: 'AI service unavailable', conversation: conversationHistory }))
  }

  // Append both turns to conversation
  const now = new Date().toISOString()
  const userTurn: AiConversationTurn = { role: 'user', content: question, timestamp: now }
  const assistantTurn: AiConversationTurn = { role: 'assistant', content: answer, timestamp: now }
  const updatedConversation: AiConversationTurn[] = [...conversationHistory, userTurn, assistantTurn]

  // Persist updated cache
  const updatedCache: AiAnalysisCache = {
    diagnosis: cached?.diagnosis ?? null,
    conversation: updatedConversation,
    lastPhotoSnapshot: cached?.lastPhotoSnapshot ?? [],
  }

  await prisma.maintenanceTicket.update({
    where: { id: params.id },
    data: { aiAnalysis: updatedCache as unknown as object },
  })

  return NextResponse.json(ok({ available: true, answer, conversation: updatedConversation }))
}, { permission: PERMISSIONS.MAINTENANCE_CLAIM })
