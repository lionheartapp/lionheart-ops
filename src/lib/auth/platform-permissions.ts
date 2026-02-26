/**
 * Platform-Level Permissions
 * 
 * These are for platform admins (SaaS operators) managing all schools.
 * Completely separate from org-scoped permissions.
 */

import { rawPrisma } from '@/lib/db'
import { PlatformAdminRole } from '@prisma/client'

export const PLATFORM_PERMISSIONS = {
  // Organizations
  ORGANIZATIONS_READ: 'platform:organizations:read',
  ORGANIZATIONS_UPDATE: 'platform:organizations:update',
  ORGANIZATIONS_SUSPEND: 'platform:organizations:suspend',
  
  // Subscriptions & Billing
  SUBSCRIPTIONS_READ: 'platform:subscriptions:read',
  SUBSCRIPTIONS_UPDATE: 'platform:subscriptions:update',
  PLANS_MANAGE: 'platform:plans:manage',
  PAYMENTS_READ: 'platform:payments:read',
  
  // Discount Codes
  DISCOUNT_CODES_READ: 'platform:discount-codes:read',
  DISCOUNT_CODES_MANAGE: 'platform:discount-codes:manage',
  
  // Support Tickets
  SUPPORT_TICKETS_READ: 'platform:support-tickets:read',
  SUPPORT_TICKETS_MANAGE: 'platform:support-tickets:manage',
  
  // Audit Logs
  AUDIT_LOGS_READ: 'platform:audit-logs:read',
  
  // Platform Settings & Admin Management
  PLATFORM_SETTINGS: 'platform:settings:manage',
  ADMINS_MANAGE: 'platform:admins:manage',
  
  // Wildcard
  ALL: 'platform:*',
} as const

/**
 * Permissions granted to each platform admin role
 */
const ROLE_PERMISSIONS: Record<PlatformAdminRole, string[]> = {
  SUPER_ADMIN: [PLATFORM_PERMISSIONS.ALL],
  OPERATOR: [
    PLATFORM_PERMISSIONS.ORGANIZATIONS_READ,
    PLATFORM_PERMISSIONS.ORGANIZATIONS_UPDATE,
    PLATFORM_PERMISSIONS.SUBSCRIPTIONS_READ,
    PLATFORM_PERMISSIONS.PLANS_MANAGE,
    PLATFORM_PERMISSIONS.PAYMENTS_READ,
    PLATFORM_PERMISSIONS.DISCOUNT_CODES_READ,
    PLATFORM_PERMISSIONS.DISCOUNT_CODES_MANAGE,
    PLATFORM_PERMISSIONS.SUPPORT_TICKETS_READ,
    PLATFORM_PERMISSIONS.SUPPORT_TICKETS_MANAGE,
    PLATFORM_PERMISSIONS.AUDIT_LOGS_READ,
  ],
}

/**
 * Get permissions for a platform admin role
 */
export function getPlatformRolePermissions(role: PlatformAdminRole): string[] {
  return ROLE_PERMISSIONS[role] || []
}

/**
 * Check if a platform admin has a specific permission
 */
export function platformAdminCan(role: PlatformAdminRole, permission: string): boolean {
  const perms = getPlatformRolePermissions(role)
  return perms.some(p => p === 'platform:*' || p === permission)
}

/**
 * Assert platform admin has permission (throws if not)
 */
export function assertPlatformAdminCan(
  role: PlatformAdminRole,
  permission: string,
  message?: string
): void {
  if (!platformAdminCan(role, permission)) {
    throw new Error(message || `Insufficient platform permissions: ${permission}`)
  }
}

/**
 * Platform admin request context
 */
export type PlatformAdminContext = {
  adminId: string
  email: string
  role: PlatformAdminRole
  name: string | null
}

/**
 * Get platform admin context from admin ID (fetches from DB)
 */
export async function getPlatformAdminById(adminId: string): Promise<PlatformAdminContext | null> {
  const admin = await rawPrisma.platformAdmin.findUnique({
    where: { id: adminId },
    select: { id: true, email: true, role: true, name: true },
  })
  if (!admin) return null
  return {
    adminId: admin.id,
    email: admin.email,
    role: admin.role,
    name: admin.name,
  }
}
