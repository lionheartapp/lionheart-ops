/**
 * Organization Registration Service
 * 
 * Handles school signup/onboarding, including slug validation and uniqueness checks.
 * This is the entry point for new schools joining the platform.
 */

import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const rawPrisma = new PrismaClient()

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

/**
 * Organization signup request schema
 */
export const CreateOrganizationSchema = z.object({
  name: z.string().min(2, 'School name must be at least 2 characters').max(100),
  schoolType: z.enum(['ELEMENTARY', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL', 'GLOBAL']).default('GLOBAL'),
  slug: SlugSchema,
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
 * Create a new organization (used in signup/onboarding)
 * Validates all inputs including slug uniqueness before creating
 * 
 * @param input - Organization and admin user data
 * @returns Created organization with admin user
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

  // Create organization and admin user
  const result = await rawPrisma.organization.create({
    data: {
      name: validated.name,
      schoolType: validated.schoolType,
      slug: validated.slug.toLowerCase(),
      users: {
        create: {
          email: validated.adminEmail,
          name: validated.adminName,
          passwordHash,
          role: 'ADMIN',
        },
      },
    },
    include: {
      users: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      },
    },
  })

  return result
}
