import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { sendBrandedEmail } from '@/lib/services/email/transport'

const SendEmailSchema = z.object({
  email: z.string().email(),
  linkUrl: z.string().url(),
  expiresAt: z.string(),
})

export const POST = withAuth<z.infer<typeof SendEmailSchema>>(async ({ body, ctx }) => {
  const { email, linkUrl, expiresAt } = body

  const result = await sendBrandedEmail(
    'magic_link' as 'welcome', // Use welcome template structure as base
    email,
    {
      subject: 'Your IT Help Desk Access Link',
      heading: 'IT Help Desk Access',
      body_text: `You've been given a link to submit IT support requests. Click the button below to access the help desk — no login required.`,
      cta_label: 'Open Help Desk',
      cta_url: linkUrl,
      footer_text: `This link expires on ${new Date(expiresAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}. It can only be used once.`,
    }
  )

  if (!result.sent) {
    return NextResponse.json(
      fail('EMAIL_FAILED', 'Failed to send email. Check email configuration.'),
      { status: 500 }
    )
  }

  return NextResponse.json(ok({ sent: true }))
}, { permission: PERMISSIONS.IT_MAGICLINK_GENERATE, schema: SendEmailSchema })
