import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { classifyTicketIntake } from '@/lib/services/ai/ticket-intake.service'

const ClassifySchema = z.object({
  description: z.string().min(5, 'Description too short').max(2000),
  module: z.enum(['MAINTENANCE', 'IT']).optional(),
})

export const POST = withAuth<z.infer<typeof ClassifySchema>>(async ({ body }) => {
  const classification = await classifyTicketIntake(body.description, body.module)

  if (!classification) {
    return NextResponse.json(
      fail('AI_UNAVAILABLE', 'AI classification is not available. Please select the category manually.'),
      { status: 503 }
    )
  }

  return NextResponse.json(ok(classification))
}, {
  permissionAny: [PERMISSIONS.MAINTENANCE_SUBMIT, PERMISSIONS.IT_TICKET_SUBMIT],
  schema: ClassifySchema,
})
