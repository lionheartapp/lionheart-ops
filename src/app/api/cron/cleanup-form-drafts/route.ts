/**
 * POST /api/cron/cleanup-form-drafts — Delete expired form submission drafts
 *
 * Runs daily via Vercel Cron. Deletes FormSubmission records where
 * isDraft=true and draftExpiresAt has passed.
 *
 * Secured by CRON_SECRET in the Authorization header.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { rawPrisma } from '@/lib/db'
import { logger } from '@/lib/logger'

const log = logger.child({ module: 'cron:cleanup-form-drafts' })

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) {
    return NextResponse.json(fail('UNAUTHORIZED', 'Missing cron secret'), { status: 401 })
  }

  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret) {
    log.error('CRON_SECRET not configured')
    return NextResponse.json(fail('CONFIGURATION_ERROR', 'Cron not configured'), { status: 500 })
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(fail('UNAUTHORIZED', 'Invalid cron secret'), { status: 401 })
  }

  try {
    const now = new Date()

    // Hard-delete expired drafts (bypasses soft-delete since drafts are disposable)
    const result = await rawPrisma.formSubmission.deleteMany({
      where: {
        isDraft: true,
        draftExpiresAt: { lt: now },
      },
    })

    log.info({ deletedCount: result.count }, 'Expired form drafts cleaned up')

    return NextResponse.json(ok({ deletedCount: result.count }))
  } catch (err) {
    log.error({ err }, 'Draft cleanup failed')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Cleanup failed'), { status: 500 })
  }
}
