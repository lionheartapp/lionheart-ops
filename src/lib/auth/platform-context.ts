/**
 * Platform Admin Request Context
 * 
 * Extract platform admin identity from request headers.
 * The middleware sets x-platform-admin-id after verifying the platform JWT.
 */

import { NextRequest } from 'next/server'
import { rawPrisma } from '@/lib/db'
import { PlatformAdminRole } from '@prisma/client'

export type PlatformRequestContext = {
  adminId: string
  email: string
  role: PlatformAdminRole
  name: string | null
}

/**
 * Get platform admin context from request.
 * Reads x-platform-admin-id header (set by middleware after JWT verification).
 */
export async function getPlatformContext(req: NextRequest): Promise<PlatformRequestContext> {
  const adminId = req.headers.get('x-platform-admin-id')
  if (!adminId) {
    throw new Error('Missing platform admin context')
  }

  const admin = await rawPrisma.platformAdmin.findUnique({
    where: { id: adminId },
    select: { id: true, email: true, role: true, name: true },
  })

  if (!admin) {
    throw new Error('Platform admin not found')
  }

  return {
    adminId: admin.id,
    email: admin.email,
    role: admin.role,
    name: admin.name,
  }
}
