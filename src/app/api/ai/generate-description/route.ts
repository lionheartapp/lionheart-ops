import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { getUserContext } from '@/lib/request-context'
import { geminiService } from '@/lib/services/ai/gemini.service'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

const GenerateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  context: z.string().max(500).optional(),
})

export async function POST(req: NextRequest) {
  const log = logger.child({ route: '/api/ai/generate-description', method: 'POST' })
  try {
    await getUserContext(req)
    const body = await req.json()
    const { title, context } = GenerateSchema.parse(body)

    const description = await geminiService.generateEventDescription(title, context)
    return NextResponse.json(ok({ description }))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    log.error({ err: error }, 'Failed to generate description')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to generate description'), { status: 500 })
  }
}
