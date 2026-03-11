import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { sendContactFormEmail } from '@/lib/services/emailService'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Valid email address required'),
  subject: z.string().max(200).optional(),
  message: z.string().min(10, 'Message must be at least 10 characters').max(2000),
})

export async function POST(req: NextRequest) {
  const log = logger.child({ route: '/api/public/contact', method: 'POST' })
  try {
    const body = await req.json()
    const parsed = contactSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues as unknown[]),
        { status: 400 }
      )
    }

    await sendContactFormEmail(parsed.data)

    return NextResponse.json(ok({ sent: true }))
  } catch (error) {
    log.error({ err: error }, 'Failed to send contact form email')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Something went wrong'),
      { status: 500 }
    )
  }
}
