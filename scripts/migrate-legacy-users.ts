/**
 * Legacy User Migration Script
 * 
 * Migrates existing users from old UserRole enum to new permission system:
 * - Maps old role enum → new roleId
 * - Assigns appropriate teamIds based on role
 * 
 * Run once: npx tsx scripts/migrate-legacy-users.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Starting legacy user migration...\n')

  // Get all organizations to find their role mappings
  const orgs = await prisma.organization.findMany({
    select: { id: true, slug: true },
  })

  console.log(`📊 Found ${orgs.length} organization(s)`)

  for (const org of orgs) {
    console.log(`\n🏢 Migrating users in: ${org.slug}`)

    // Get roles for this org
    const roles = await prisma.role.findMany({
      where: { organizationId: org.id },
      select: { id: true, slug: true },
    })

    const roleMap = new Map(roles.map((r) => [r.slug, r.id]))

    // Get users that need migration (have old role but no new roleId)
    const users = await prisma.user.findMany({
      where: {
        organizationId: org.id,
        roleId: null,
      },
      select: { id: true, email: true, role: true },
    })

    console.log(`   Found ${users.length} users to migrate`)

    for (const user of users) {
      // Map old role enum to new role slug
      let newRoleSlug: string
      let teamIds: string[] = []

      switch (user.role) {
        case 'SUPER_ADMIN':
          newRoleSlug = 'super-admin'
          teamIds = ['administration']
          break
        case 'ADMIN':
          newRoleSlug = 'admin'
          teamIds = ['administration']
          break
        case 'OPERATIONS':
          newRoleSlug = 'admin' // Operations mapped to admin role
          teamIds = ['it-support', 'maintenance']
          break
        case 'TEACHER':
          newRoleSlug = 'member'
          teamIds = ['teachers']
          break
        case 'VIEWER':
          newRoleSlug = 'viewer'
          teamIds = []
          break
        default:
          console.warn(`   ⚠️  Unknown role ${user.role} for ${user.email}, defaulting to member`)
          newRoleSlug = 'member'
          teamIds = []
      }

      const newRoleId = roleMap.get(newRoleSlug)
      if (!newRoleId) {
        console.error(`   ❌ Role ${newRoleSlug} not found for org ${org.slug}`)
        continue
      }

      // Update user
      await prisma.user.update({
        where: { id: user.id },
        data: {
          roleId: newRoleId,
          teamIds,
        },
      })

      console.log(`   ✅ ${user.email}: ${user.role} → ${newRoleSlug} (teams: ${teamIds.join(', ') || 'none'})`)
    }
  }

  console.log('\n🎉 Migration complete!')
}

main()
  .catch((error) => {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
