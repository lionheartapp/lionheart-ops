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
    console.error('Error checking slug availability:', error)
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
export async function seedOrgDefaults(orgId: string): Promise<{ superAdminRoleId: string }> {
  // ── Step 1: Collect every unique permission string used across all default roles ──
  const allPermStrings = new Set<string>()
  for (const roleDef of Object.values(DEFAULT_ROLES)) {
    for (const perm of roleDef.permissions) {
      allPermStrings.add(perm)
    }
  }

  // ── Step 2: Upsert permissions into the global Permission table ──
  // Permission rows are shared across orgs; if they already exist (from a prior signup)
  // we simply reuse them.
  const permissionMap = new Map<string, string>() // permString → db id

  await Promise.all(
    Array.from(allPermStrings).map(async (permString) => {
      const { resource, action, scope } = parsePermissionString(permString)
      const row = await rawPrisma.permission.upsert({
        where: { resource_action_scope: { resource, action, scope } },
        create: { resource, action, scope },
        update: {}, // already exists — nothing to change
        select: { id: true },
      })
      permissionMap.set(permString, row.id)
    })
  )

  // ── Step 3: Create org-scoped roles and link their permissions ──
  let superAdminRoleId = ''

  for (const roleDef of Object.values(DEFAULT_ROLES)) {
    const role = await rawPrisma.role.create({
      data: {
        organizationId: orgId,
        name:           roleDef.name,
        slug:           roleDef.slug,
        description:    roleDef.description,
        isSystem:       roleDef.isSystem,
        permissions: {
          create: roleDef.permissions.map((permString) => ({
            permissionId: permissionMap.get(permString)!,
          })),
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

  // ── Step 4: Create org-scoped default teams ──
  await Promise.all(
    Object.values(DEFAULT_TEAMS).map((teamDef) =>
      rawPrisma.team.create({
        data: {
          organizationId: orgId,
          name:           teamDef.name,
          slug:           teamDef.slug,
          description:    teamDef.description,
        },
      })
    )
  )

  return { superAdminRoleId }
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

  // Validate slug uniqueness
  const slugValid = await validateSlug(validated.slug)
  if (!slugValid.valid) {
    throw new Error(`Slug validation failed: ${slugValid.reason}`)
  }

  // Hash password
  const passwordHash = await bcrypt.hash(validated.adminPassword, 10)

  // ── Step 1: Create the organization and its first admin user ──
  const org = await rawPrisma.organization.create({
    data: {
      name:            validated.name,
      institutionType: validated.institutionType,
      gradeLevel:      validated.gradeLevel,
      slug:            validated.slug.toLowerCase(),
      physicalAddress: validated.physicalAddress ?? null,
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

  // ── Step 2: Seed default roles, permissions, and teams ──
  const { superAdminRoleId } = await seedOrgDefaults(org.id)

  // ── Step 3: Assign the super-admin role to the first admin user ──
  const updatedUser = await rawPrisma.user.update({
    where: { id: adminUser.id },
    data:  { roleId: superAdminRoleId },
    select: {
      id:     true,
      email:  true,
      name:   true,
      roleId: true,
    },
  })

  return {
    ...org,
    users: [updatedUser],
  }
}
