import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { getUserContext } from '@/lib/request-context'
import { geminiService } from '@/lib/services/ai/gemini.service'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

const ParseEventSchema = z.object({
  text: z.string().trim().min(3).max(2000),
})

export async function POST(req: NextRequest) {
  const log = logger.child({ route: '/api/ai/parse-event', method: 'POST' })
  try {
    await getUserContext(req)
    const body = await req.json()
    const { text } = ParseEventSchema.parse(body)

    const parsed = await geminiService.parseEventFromText(text)
    return NextResponse.json(ok(parsed))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    log.error({ err: error }, 'Failed to parse event')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to parse event'), { status: 500 })
  }
}
