import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthToken } from '@/lib/auth'
import { can } from '@/lib/auth/permissions'
import { ok, fail } from '@/lib/api-response'

/** GET /api/auth/permissions — returns current user's permission flags (e.g. canManageWorkspace). */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return NextResponse.json(fail('UNAUTHORIZED', 'Missing or invalid Authorization header'), { status: 401 })
  }

  const claims = await verifyAuthToken(token)
  if (!claims) {
    return NextResponse.json(fail('UNAUTHORIZED', 'Invalid or expired token'), { status: 401 })
  }

  const canManageWorkspace = await can(claims.userId, 'settings:manage')
  return NextResponse.json(ok({ canManageWorkspace }))
}
