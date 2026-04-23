/**
 * Organization Registration Service
 *
 * Handles org signup/onboarding: slug validation, uniqueness checks, and the
 * full first-run bootstrap (org → primary school → default campus → roles,
 * teams, calendars, first admin user).
 *
 * NEW ONTOLOGY (Phase 1b):
 *   - Organization no longer carries institutionType / gradeLevel / principal*
 *     / physicalAddress / district / gradeRange. Those fields moved to the
 *     School model (institution) or District.
 *   - UserCampusAssignment was dropped in favor of User.campusId (direct FK).
 *   - Campus.campusType was renamed to Campus.campusKind.
 *
 *   The signup schema still accepts the legacy field names on input; we route
 *   them to the appropriate new model during creation.
 */

import { z } from 'zod'
import { rawPrisma } from '@/lib/db'
import * as bcrypt from 'bcryptjs'
import { isPasswordBreached } from '@/lib/validation/password-breach-check'
import { DEFAULT_ROLES, DEFAULT_TEAMS } from '@/lib/permissions'
import { timezoneFromAddress } from '@/lib/utils/timezone'
import { logger } from '@/lib/logger'
import { computeTrialEndDate } from '@/lib/trial-utils'


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
 *
 * Note: `institutionType`, `gradeLevel`, `principal*`, `physicalAddress`,
 * `district`, and `gradeRange` live on downstream models (School / District)
 * in the new ontology. We still accept them on input and route them to the
 * primary School record we create for the org.
 */
export const CreateOrganizationSchema = z.object({
  name: z.string().min(2, 'School name must be at least 2 characters').max(100),
  institutionType: z
    .enum(['PUBLIC', 'PRIVATE', 'CHARTER', 'HYBRID', 'FAITH_BASED'])
    .default('PRIVATE'),
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
  adminPassword: z.string().min(8, 'Password must be at least 8 characters').max(64),
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
 * Seed default roles, permissions, teams, campus, and campus master calendar
 * for a newly-created organization.
 *
 * - Permissions are global (no org ID) and upserted so they're safe to call
 *   repeatedly.
 * - Roles and Teams are org-scoped and created fresh for each new org.
 * - The default campus is a HEADQUARTERS `Campus` row linked to the primary
 *   `School` (if provided) with coordinates copied through.
 *
 * @returns The super-admin role ID (assigned to the first admin) and the
 *          default campus ID (assigned to the first admin's campusId).
 */
export async function seedOrgDefaults(
  orgId: string,
  opts: {
    primarySchoolId?: string | null
    campusAddress?: string | null
    campusLatitude?: number | null
    campusLongitude?: number | null
    campusName?: string | null
  } = {}
): Promise<{ superAdminRoleId: string; defaultCampusId: string }> {
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
  //
  // The campus lives under the primary School (if one was provided) and
  // inherits address/coords from the signup payload.
  const defaultCampus = await rawPrisma.campus.create({
    data: {
      organizationId: orgId,
      schoolId: opts.primarySchoolId ?? null,
      name: opts.campusName ?? 'Main Campus',
      address: opts.campusAddress ?? null,
      latitude: opts.campusLatitude ?? null,
      longitude: opts.campusLongitude ?? null,
      campusKind: 'HEADQUARTERS',
      isActive: true,
      sortOrder: 0,
    },
    select: { id: true, name: true },
  })

  // ── Step 6: Create campus master calendar ──
  const campusCalendarName = `${defaultCampus.name} Master`
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
 *
 * Flow:
 *   1. Validate input + slug uniqueness + password strength.
 *   2. Create the Organization shell + first admin user (no roleId yet).
 *   3. If the signup provided institution-level fields (principal, address,
 *      institutionType), create a primary `School` to hold them.
 *   4. If a district name was provided, create a `District` and link the
 *      school to it.
 *   5. Seed roles, permissions, teams, default HEADQUARTERS campus, and the
 *      campus master calendar via `seedOrgDefaults` — which links the campus
 *      to the primary school when present.
 *   6. Assign the super-admin role to the admin user, create their personal
 *      calendar, and set their `campusId` to the default campus.
 *
 * On any failure after step 2, the Organization row is hard-deleted so cascade
 * relations clean up everything that was created.
 */
export async function createOrganization(input: CreateOrganizationInput) {
  // Validate schema
  const validated = CreateOrganizationSchema.parse(input)

  // Validate slug uniqueness (outside transaction — read-only check)
  const slugValid = await validateSlug(validated.slug)
  if (!slugValid.valid) {
    throw new Error(`Slug validation failed: ${slugValid.reason}`)
  }

  // Check if password has appeared in known data breaches
  if (await isPasswordBreached(validated.adminPassword)) {
    throw new Error('This password has appeared in a data breach and is not safe to use. Please choose a different password.')
  }

  // Hash password (outside transaction — CPU-bound, not a DB operation)
  const passwordHash = await bcrypt.hash(validated.adminPassword, 10)

  // Derive a timezone from the supplied address (if any) for compliance maths.
  const detectedTimezone = timezoneFromAddress(validated.physicalAddress)

  // Start the 30-day no-card free trial clock at org creation. No Stripe
  // subscription exists yet — upgrades happen later from settings → billing.
  const trialStartedAt = new Date()
  const trialEndsAt = computeTrialEndDate(trialStartedAt)

  // Step 1: Create the organization and its first admin user.
  //
  // Only org-level fields live here now. Institution-level fields
  // (institutionType, principal*, address, grade range) move to the primary
  // School we create in step 2.
  const org = await rawPrisma.organization.create({
    data: {
      name:            validated.name,
      slug:            validated.slug.toLowerCase(),
      ...(detectedTimezone ? { timezone: detectedTimezone } : {}),
      website:         validated.website ?? null,
      phone:           validated.phone ?? null,
      studentCount:    validated.studentCount ?? null,
      staffCount:      validated.staffCount ?? null,
      trialStartedAt,
      trialEndsAt,
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
    // Step 2: (Optional) Create a District to hold the org's district name.
    let districtId: string | null = null
    if (validated.district) {
      const district = await rawPrisma.district.create({
        data: {
          organizationId: org.id,
          name: validated.district,
          isDefault: true,
        },
        select: { id: true },
      })
      districtId = district.id
    }

    // Step 3: Create the primary School that holds institution-level fields.
    //
    // We always create one — even if the signup didn't supply principal info
    // — so there's a canonical "school" row the app can point to for
    // single-school orgs.
    const primarySchool = await rawPrisma.school.create({
      data: {
        organizationId: org.id,
        districtId,
        name: validated.name,
        institutionType: validated.institutionType,
        address: validated.physicalAddress ?? null,
        principalName: validated.principalName ?? validated.adminName,
        principalEmail: validated.principalEmail ?? validated.adminEmail,
        principalPhone: validated.principalPhone ?? null,
      },
      select: { id: true },
    })

    // Step 4: Seed default roles/permissions/teams + default HEADQUARTERS
    // campus linked to the primary school.
    const { superAdminRoleId, defaultCampusId } = await seedOrgDefaults(org.id, {
      primarySchoolId: primarySchool.id,
      campusAddress: validated.physicalAddress ?? null,
      campusName: 'Main Campus',
    })

    // Step 5: Assign the super-admin role AND campus to the admin user.
    //
    // NEW ONTOLOGY: campusId is a direct FK on User — no junction table.
    const updatedUser = await rawPrisma.user.update({
      where: { id: adminUser.id },
      data: {
        roleId: superAdminRoleId,
        campusId: defaultCampusId,
        schoolId: primarySchool.id,
        districtId,
      },
      select: {
        id:     true,
        email:  true,
        name:   true,
        roleId: true,
        firstName: true,
        lastName: true,
      },
    })

    // Step 6: Create the admin's personal calendar.
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
