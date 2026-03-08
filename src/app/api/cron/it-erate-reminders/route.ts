import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { sendERateReminders } from '@/lib/services/itERateService'

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace('Bearer ', '')
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Invalid cron secret'), { status: 401 })
    }

    await sendERateReminders()
    return NextResponse.json(ok({ success: true }))
  } catch (error) {
    console.error('E-Rate reminders cron failed:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
