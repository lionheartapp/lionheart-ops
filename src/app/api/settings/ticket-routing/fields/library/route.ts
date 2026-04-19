import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getFieldsForModule } from '@/lib/services/categoryFieldLibrary'
import type { TicketModule } from '@prisma/client'

export const GET = withAuth(async ({ searchParams }) => {
  const module = searchParams.get('module')
  if (!module || !['MAINTENANCE', 'IT'].includes(module)) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'module query param required'),
      { status: 400 }
    )
  }

  const fields = getFieldsForModule(module as TicketModule)
  return NextResponse.json(ok(fields))
}, { permission: PERMISSIONS.SETTINGS_READ })
