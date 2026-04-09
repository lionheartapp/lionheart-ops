/**
 * Organization Registration Service
 *
 * Handles school signup/onboarding, including slug validation and uniqueness checks.
 * This is the entry point for new schools joining the platform.
 */

import { z } from 'zod'
import { rawPrisma } from '@/lib/db'
import * as bcrypt from 'bcryptjs'
import { DEFAULT_ROLES, DEFAULT_TEAMS } from '@/lib/permissions'
import { timezoneFromAddress } from '@/lib/utils/timezone'
import { logger } from '@/lib/logger'


const log = logger.child({ service: 'organizationRegistrationService' })
/**
 * Slug validation schema
 * - 3-50 characters
 * - lowercase letters, numbers, hyphens only
 * - must start and end with letter or number
 * - no consecutive hyphens
 * Examples: demo, mitchell-academy, acme123
 */
export const SlugSchema = z
  .string()
  .min(3, 'Slug must be at least 3 characters')
  .max(50, 'Slug must be at most 50 characters')
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Slug can only contain lowercase letters, numbers, and hyphens (no consecutive hyphens)'
  )

const NullableText = (max: number) =>
  z.preprocess(
    (value) => {
      if (typeof value !== 'string') return value
      const trimmed = value.trim()
      return trimmed.length === 0 ? null : trimmed
    },
    z.string().max(max).nullable().optional()
  )

/**
 * Organization signup request schema
 */
export const CreateOrganizationSchema = z.object({
  name: z.string().min(2, 'School name must be at least 2 characters').max(100),
  institutionType: z.enum(['PUBLIC', 'PRIVATE', 'CHARTER', 'HYBRID']).default('PUBLIC'),
  gradeLevel: z.enum(['ELEMENTARY', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL', 'GLOBAL']).default('GLOBAL'),
  slug: SlugSchema,
  physicalAddress: NullableText(400),
  district: NullableText(160),
  website: z.preprocess(
    (value) => {
      if (typeof value !== 'string') return value
      const trimmed = value.trim()
      return trimmed.length === 0 ? null : trimmed
    },
    z.string().url('Website must be a valid URL (include https://)').max(300).nullable().optional()
  ),
  phone: NullableText(40),
  principalName: NullableText(120),
  principalEmail: z.preprocess(
    (value) => {
      if (typeof value !== 'string') return value
      const trimmed = value.trim()
      return trimmed.length === 0 ? null : trimmed
    },
    z.string().email('Principal email must be valid').max(255).nullable().optional()
  ),
  principalPhone: NullableText(40),
  gradeRange: NullableText(80),
  studentCount: z.number().int().min(0).max(1000000).nullable().optional(),
  staffCount: z.number().int().min(0).max(1000000).nullable().optional(),
  adminEmail: z.string().email('Invalid email address'),
  adminName: z.string().min(2, 'Name must be at least 2 characters').max(100),
  adminPassword: z.string().min(8, 'Password must be at least 8 characters'),
})

export type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>

/**
 * Check if a slug is available (not already taken)
 * Used during signup to validate slug uniqueness in real-time
 * 
 * @param slug - The proposed slug
 * @returns true if available, false if already taken
 */
export async function isSlugAvailable(slug: string): Promise<boolean> {
  try {
    const existing = await rawPrisma.organization.findUnique({
      where: { slug: slug.toLowerCase() },
      select: { id: true },
    })
    return !existing
  } catch (error) {
    log.error({ err: String(error) }, 'Error checking slug availability')
    throw new Error('Failed to validate slug availability')
  }
}

/**
 * Validate slug format and availability
 * Called during signup before creating organization
 * 
 * @param slug - The proposed slug
 * @returns { valid: true } if ok, or { valid: false, reason: string } if not
 */
export async function validateSlug(
  slug: string
): Promise<{ valid: true } | { valid: false; reason: string }> {
  // Format validation
  const formatResult = SlugSchema.safeParse(slug.toLowerCase())
  if (!formatResult.success) {
    return {
      valid: false,
      reason: formatResult.error.issues[0].message,
    }
  }

  // Uniqueness check
  const available = await isSlugAvailable(slug)
  if (!available) {
    return {
      valid: false,
      reason: `"${slug}" is already taken. Try something like "${slug}-academy" or "${slug}123".`,
    }
  }

  return { valid: true }
}

/**
 * Parse a permission string into its component parts for DB storage.
 *   "tickets:create"   → { resource: 'tickets', action: 'create', scope: 'global' }
 *   "tickets:read:own" → { resource: 'tickets', action: 'read',   scope: 'own'    }
 *   "*:*"              → { resource: '*',        action: '*',      scope: 'global' }
 */
function parsePermissionString(perm: string): { resource: string; action: string; scope: string } {
  const parts = perm.split(':')
  return {
    resource: parts[0] ?? '*',
    action:   parts[1] ?? '*',
    scope:    parts[2] ?? 'global',
  }
}

/**
 * Seed default roles, permissions, and teams for a newly created organization.
 *
 * - Permissions are global (no org ID) and upserted so they're safe to call many times.
 * - Roles and Teams are org-scoped and created fresh for each new org.
 *
 * @returns The ID of the newly created super-admin role (to assign to the first admin user)
 */
export async function seedOrgDefaults(orgId: string): Promise<{ superAdminRoleId: string; defaultCampusId: string }> {
  // ── Step 1: Collect every unique permission string used across all default roles ──
  const allPermStrings = new Set<string>()
  for (const roleDef of Object.values(DEFAULT_ROLES)) {
    for (const perm of roleDef.permissions) {
      allPermStrings.add(perm)
    }
  }

  // ── Step 2: Batch-seed the global Permission table (3 queries instead of ~175) ──
  //
  // Previously this did ~175 sequential upserts — 15+ seconds on serverless
  // connection pool. Now: findMany existing → createMany missing → findMany
  // all → build the map. Permissions are global (shared across orgs) so this
  // is safe.
  const parsedPerms = Array.from(allPermStrings).map((permString) => {
    const { resource, action, scope } = parsePermissionString(permString)
    return { permString, resource, action, scope }
  })

  // Fetch every permission tuple that already exists (one query).
  // Each parsed tuple is unique after deduping via the Set above, but the
  // same (resource, action, scope) might come from multiple strings (e.g.
  // "*:*" and "*:*:global") — that's fine, the map below handles it.
  const whereClauses = parsedPerms.map(({ resource, action, scope }) => ({
    resource,
    action,
    scope,
  }))
  const existingRows = await rawPrisma.permission.findMany({
    where: { OR: whereClauses },
    select: { id: true, resource: true, action: true, scope: true },
  })

  const tupleKey = (r: string, a: string, s: string) => `${r}::${a}::${s}`
  const existingByTuple = new Map<string, string>() // tuple → db id
  for (const row of existingRows) {
    existingByTuple.set(tupleKey(row.resource, row.action, row.scope), row.id)
  }

  // Figure out which tuples are missing and need creation.
  const missingTuples: Array<{ resource: string; action: string; scope: string }> = []
  const seenMissing = new Set<string>()
  for (const p of parsedPerms) {
    const key = tupleKey(p.resource, p.action, p.scope)
    if (!existingByTuple.has(key) && !seenMissing.has(key)) {
      missingTuples.push({ resource: p.resource, action: p.action, scope: p.scope })
      seenMissing.add(key)
    }
  }

  // createMany the missing rows in a single query.
  if (missingTuples.length > 0) {
    await rawPrisma.permission.createMany({
      data: missingTuples,
      skipDuplicates: true,
    })

    // Re-fetch the newly-created rows to pick up their IDs.
    const newRows = await rawPrisma.permission.findMany({
      where: { OR: missingTuples },
      select: { id: true, resource: true, action: true, scope: true },
    })
    for (const row of newRows) {
      existingByTuple.set(tupleKey(row.resource, row.action, row.scope), row.id)
    }
  }

  // Build the string → id map callers need.
  const permissionMap = new Map<string, string>()
  for (const p of parsedPerms) {
    const id = existingByTuple.get(tupleKey(p.resource, p.action, p.scope))
    if (!id) {
      throw new Error(`seedOrgDefaults: permission tuple not found after seeding: ${p.permString}`)
    }
    permissionMap.set(p.permString, id)
  }

  // ── Step 3: Create org-scoped roles and link their permissions ──
  //
  // Each role is created sequentially (one query per role) with a nested
  // RolePermission createMany. Sequentially to stay within the serverless
  // connection pool. Defensive dedupe on the permissions list so duplicate
  // entries in a role definition don't trigger a unique constraint.
  let superAdminRoleId = ''

  for (const roleDef of Object.values(DEFAULT_ROLES)) {
    // Map permission strings → IDs and dedupe (same tuple from different
    // strings still gets inserted once).
    const seenPermIds = new Set<string>()
    const permissionLinks: Array<{ permissionId: string }> = []
    for (const permString of roleDef.permissions) {
      const permId = permissionMap.get(permString)
      if (!permId || seenPermIds.has(permId)) continue
      seenPermIds.add(permId)
      permissionLinks.push({ permissionId: permId })
    }

    const role = await rawPrisma.role.create({
      data: {
        organizationId: orgId,
        name:           roleDef.name,
        slug:           roleDef.slug,
        description:    roleDef.description,
        isSystem:       roleDef.isSystem,
        permissions: {
          createMany: {
            data: permissionLinks,
            skipDuplicates: true,
          },
        },
      },
      select: { id: true, slug: true },
    })

    if (role.slug === 'super-admin') {
      superAdminRoleId = role.id
    }
  }

  if (!superAdminRoleId) {
    throw new Error('seedOrgDefaults: super-admin role was not created')
  }

  // ── Step 4: Create org-scoped default teams (1 query via createMany) ──
  await rawPrisma.team.createMany({
    data: Object.values(DEFAULT_TEAMS).map((teamDef) => ({
      organizationId: orgId,
      name:           teamDef.name,
      slug:           teamDef.slug,
      description:    teamDef.description,
      teamType:       null,
    })),
    skipDuplicates: true,
  })

  // ── Step 5: Create default headquarters campus ──
  const org = await rawPrisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true, physicalAddress: true, latitude: true, longitude: true },
  })

  const defaultCampus = await rawPrisma.campus.create({
    data: {
      organizationId: orgId,
      name: 'Main Campus',
      address: org?.physicalAddress ?? null,
      latitude: org?.latitude ?? null,
      longitude: org?.longitude ?? null,
      campusType: 'HEADQUARTERS',
      isActive: true,
      sortOrder: 0,
    },
    select: { id: true },
  })

  // ── Step 6: Create campus master calendar ──
  const campusCalendarName = `${org?.name ?? 'Main Campus'} Master`
  const campusCalendarSlug = `master-${defaultCampus.id.slice(-8)}`
  await rawPrisma.calendar.create({
    data: {
      organizationId: orgId,
      campusId: defaultCampus.id,
      name: campusCalendarName,
      slug: campusCalendarSlug,
      calendarType: 'GENERAL',
      visibility: 'CAMPUS',
      isDefault: true,
      color: '#3b82f6',
    },
  })

  return { superAdminRoleId, defaultCampusId: defaultCampus.id }
}

/**
 * Sync role permissions for an existing organization.
 *
 * Called when a new module is enabled so that existing orgs get
 * any permissions / roles that were added after they signed up.
 *
 * 1. Upsert all permission rows from DEFAULT_ROLES (idempotent)
 * 2. For any DEFAULT_ROLES slug that doesn't have a matching org role → create it
 * 3. For existing org roles → add any missing RolePermission links
 * 4. Clear the server-side permission cache
 */
export async function syncRolePermissions(orgId: string): Promise<void> {
  const { clearAllPermissionCaches } = await import('@/lib/auth/permissions')

  // ── Step 1: Collect every permission string across all default roles ──
  const allPermStrings = new Set<string>()
  for (const roleDef of Object.values(DEFAULT_ROLES)) {
    for (const perm of roleDef.permissions) {
      allPermStrings.add(perm)
    }
  }

  // ── Step 2: Upsert global Permission rows ──
  // Serialized to avoid exhausting the serverless Prisma connection pool.
  const permissionMap = new Map<string, string>() // permString → db id

  for (const permString of allPermStrings) {
    const { resource, action, scope } = parsePermissionString(permString)
    const row = await rawPrisma.permission.upsert({
      where: { resource_action_scope: { resource, action, scope } },
      create: { resource, action, scope },
      update: {},
      select: { id: true },
    })
    permissionMap.set(permString, row.id)
  }

  // ── Step 3: Fetch existing system roles for this org ──
  const existingRoles = await rawPrisma.role.findMany({
    where: { organizationId: orgId, isSystem: true },
    include: { permissions: { select: { permissionId: true } } },
  })
  const existingBySlug = new Map(existingRoles.map((r) => [r.slug, r]))

  // ── Step 4: Create missing roles, add missing RolePermission links ──
  for (const roleDef of Object.values(DEFAULT_ROLES)) {
    const existing = existingBySlug.get(roleDef.slug)

    if (!existing) {
      // Role doesn't exist in this org yet → create it with full permissions
      await rawPrisma.role.create({
        data: {
          organizationId: orgId,
          name: roleDef.name,
          slug: roleDef.slug,
          description: roleDef.description,
          isSystem: roleDef.isSystem,
          permissions: {
            create: roleDef.permissions.map((permString) => ({
              permissionId: permissionMap.get(permString)!,
            })),
          },
        },
      })
    } else {
      // Role exists → find which permission links are missing
      const existingPermIds = new Set(existing.permissions.map((p) => p.permissionId))
      const missingLinks = roleDef.permissions
        .map((permString) => permissionMap.get(permString)!)
        .filter((permId) => !existingPermIds.has(permId))

      if (missingLinks.length > 0) {
        await rawPrisma.rolePermission.createMany({
          data: missingLinks.map((permissionId) => ({
            roleId: existing.id,
            permissionId,
          })),
          skipDuplicates: true,
        })
      }
    }
  }

  // ── Step 5: Clear all permission caches so changes take effect immediately ──
  clearAllPermissionCaches()
}

/**
 * Create a new organization (used in signup/onboarding).
 * Validates all inputs including slug uniqueness before creating.
 * After creation, seeds default roles/permissions/teams and assigns
 * the super-admin role to the first admin user.
 *
 * @param input - Organization and admin user data
 * @returns Created organization with the admin user (role assigned)
 */
export async function createOrganization(input: CreateOrganizationInput) {
  // Validate schema
  const validated = CreateOrganizationSchema.parse(input)

  // Validate slug uniqueness (outside transaction — read-only check)
  const slugValid = await validateSlug(validated.slug)
  if (!slugValid.valid) {
    throw new Error(`Slug validation failed: ${slugValid.reason}`)
  }

  // Hash password (outside transaction — CPU-bound, not a DB operation)
  const passwordHash = await bcrypt.hash(validated.adminPassword, 10)

  // NOTE: This flow no longer uses an interactive $transaction.
  //
  // Supabase's PgBouncer (DATABASE_URL, port 6543) runs in transaction pool
  // mode, which does NOT support Prisma's interactive transactions — they
  // hang waiting for a sticky connection that the pooler can't provide,
  // eventually timing out with PrismaClientKnownRequestError (transaction
  // invalid / timeout). The old 15s→60s bump just delayed the inevitable.
  //
  // Atomicity was already broken anyway: `seedOrgDefaults` used `rawPrisma`
  // (not `tx`), so half the writes were never part of the transaction.
  //
  // Instead, if any step fails after the org is created, we hard-delete
  // the org via rawPrisma — the schema's `onDelete: Cascade` relations
  // clean up users, roles, teams, campus, calendars, and everything else.

  // Step 1: Create the organization and its first admin user
  const detectedTimezone = timezoneFromAddress(validated.physicalAddress)

  const org = await rawPrisma.organization.create({
    data: {
      name:            validated.name,
      institutionType: validated.institutionType,
      gradeLevel:      validated.gradeLevel,
      slug:            validated.slug.toLowerCase(),
      physicalAddress: validated.physicalAddress ?? null,
      ...(detectedTimezone ? { timezone: detectedTimezone } : {}),
      district:        validated.district ?? null,
      website:         validated.website ?? null,
      phone:           validated.phone ?? null,
      principalName:   validated.principalName ?? validated.adminName,
      principalEmail:  validated.principalEmail ?? validated.adminEmail,
      principalPhone:  validated.principalPhone ?? null,
      gradeRange:      validated.gradeRange ?? null,
      studentCount:    validated.studentCount ?? null,
      staffCount:      validated.staffCount ?? null,
      users: {
        create: {
          email:        validated.adminEmail,
          name:         validated.adminName,
          passwordHash,
          status:       'ACTIVE',
        },
      },
    },
    include: {
      users: { select: { id: true } },
    },
  })

  const adminUser = org.users[0]
  if (!adminUser) {
    throw new Error('createOrganization: admin user was not created')
  }

  try {
    // Step 2: Seed default roles, permissions, teams, campus, calendar
    const { superAdminRoleId, defaultCampusId } = await seedOrgDefaults(org.id)

    // Step 3: Assign the super-admin role to the first admin user
    const updatedUser = await rawPrisma.user.update({
      where: { id: adminUser.id },
      data:  { roleId: superAdminRoleId },
      select: {
        id:     true,
        email:  true,
        name:   true,
        roleId: true,
        firstName: true,
        lastName: true,
      },
    })

    // Step 4: Create admin's personal calendar
    await rawPrisma.calendar.create({
      data: {
        organizationId: org.id,
        createdById: adminUser.id,
        name: 'My Schedule',
        slug: `my-schedule-${adminUser.id.slice(-8)}`,
        calendarType: 'PERSONAL',
        visibility: 'CAMPUS',
        color: '#6366f1',
      },
    })

    // Step 5: Create admin's campus assignment
    await rawPrisma.userCampusAssignment.create({
      data: {
        organizationId: org.id,
        userId: adminUser.id,
        campusId: defaultCampusId,
        isPrimary: true,
        isActive: true,
      },
    })

    return {
      ...org,
      users: [updatedUser],
    }
  } catch (error) {
    // Cleanup: hard-delete the org so the next retry gets a clean slate.
    // Cascade relations remove users, roles, teams, campus, calendars, etc.
    log.error({ err: String(error), orgId: org.id }, 'createOrganization failed after org row — rolling back')
    try {
      await rawPrisma.organization.delete({ where: { id: org.id } })
    } catch (cleanupErr) {
      log.error({ err: String(cleanupErr), orgId: org.id }, 'Rollback cleanup failed — manual DB cleanup may be needed')
    }
    throw error
  }
}
