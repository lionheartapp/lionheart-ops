import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getUserContext } from '@/lib/request-context'
import { canAny, getLegacyRole } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'

const WORKSPACE_MANAGE_PERMISSIONS = [
  PERMISSIONS.ROLES_CREATE,
  PERMISSIONS.ROLES_UPDATE,
  PERMISSIONS.ROLES_DELETE,
  PERMISSIONS.TEAMS_CREATE,
  PERMISSIONS.TEAMS_UPDATE,
  PERMISSIONS.TEAMS_DELETE,
  PERMISSIONS.USERS_MANAGE_ROLES,
  PERMISSIONS.USERS_INVITE,
  PERMISSIONS.SETTINGS_UPDATE,
]

export async function GET(req: NextRequest) {
  try {
    const userContext = await getUserContext(req)

    const canManageWorkspace = await canAny(
      userContext.userId,
      WORKSPACE_MANAGE_PERMISSIONS
    )

    const legacyRole = await getLegacyRole(userContext.userId)

    return NextResponse.json(
      ok({
        canManageWorkspace,
        legacyRole,
      })
    )
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('authorization') ||
        error.message.includes('token') ||
        error.message.includes('User not found'))
    ) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Unauthorized'), { status: 401 })
    }

    console.error('Failed to fetch auth permissions:', error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Failed to fetch auth permissions'),
      { status: 500 }
    )
  }
}
