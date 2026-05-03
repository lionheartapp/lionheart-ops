import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getFieldsForModule } from '@/lib/services/categoryFieldLibrary'
import type { TicketModule } from '@prisma/client'

export const GET = withAuth(async ({ searchParams }) => {
  const moduleParam = searchParams.get('module')
  if (!moduleParam || !['MAINTENANCE', 'IT'].includes(moduleParam)) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'moduleParam query param required'),
      { status: 400 }
    )
  }

  const fields = getFieldsForModule(moduleParam as TicketModule)
  return NextResponse.json(ok(fields))
}, { permission: PERMISSIONS.SETTINGS_READ })
