/**
 * Shared seed utilities — used by all per-module seed scripts.
 *
 * Provides: Prisma client, org/user lookup, and helper functions.
 */

import dotenv from 'dotenv'

// Env loading — same logic as main seed.ts
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: '.env.local' })
}
dotenv.config()

import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()

/**
 * Get the first organization (for single-tenant dev seeding).
 * Throws if no org exists — run the main seed first.
 */
export async function getDefaultOrg() {
  const org = await prisma.organization.findFirst({
    orderBy: { createdAt: 'asc' },
  })
  if (!org) {
    throw new Error('No organization found. Run `npm run db:seed` first to create the base org.')
  }
  return org
}

/**
 * Get the first admin user in the org.
 */
export async function getAdminUser(organizationId: string) {
  const user = await prisma.user.findFirst({
    where: {
      organizationId,
      deletedAt: null,
      userRole: { slug: 'super-admin' },
    },
  })
  if (!user) {
    throw new Error('No admin user found. Run `npm run db:seed` first.')
  }
  return user
}

/**
 * Get or create a user by email within the org.
 */
export async function getOrCreateUser(
  organizationId: string,
  email: string,
  data: { firstName: string; lastName: string; roleSlug?: string }
) {
  const existing = await prisma.user.findUnique({
    where: { organizationId_email: { organizationId, email } },
  })
  if (existing) return existing

  // Find the role
  const role = data.roleSlug
    ? await prisma.role.findFirst({
        where: { organizationId, slug: data.roleSlug },
      })
    : null

  return prisma.user.create({
    data: {
      organizationId,
      email,
      firstName: data.firstName,
      lastName: data.lastName,
      name: `${data.firstName} ${data.lastName}`,
      status: 'ACTIVE',
      ...(role ? { roleId: role.id } : {}),
    },
  })
}

/**
 * Get a random campus for the org.
 */
export async function getDefaultCampus(organizationId: string) {
  const campus = await prisma.campus.findFirst({
    where: { organizationId, deletedAt: null },
  })
  return campus
}

/**
 * Get a random school for the org.
 */
export async function getDefaultSchool(organizationId: string) {
  const school = await prisma.school.findFirst({
    where: { organizationId, deletedAt: null },
  })
  return school
}

/**
 * Get a random building for the org.
 */
export async function getDefaultBuilding(organizationId: string) {
  const building = await prisma.building.findFirst({
    where: { organizationId, deletedAt: null },
  })
  return building
}

/**
 * Log a section header.
 */
export function logSection(label: string) {
  console.log(`\n--- ${label} ---`)
}
