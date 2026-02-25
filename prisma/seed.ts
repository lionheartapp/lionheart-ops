import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const org = await prisma.organization.upsert({
    where: { slug: 'demo' },
    create: {
      name: 'Demo School',
      slug: 'demo',
      gradeLevel: 'GLOBAL',
    },
    update: {},
  })

  const [readPerm, updatePerm] = await Promise.all([
    prisma.permission.upsert({
      where: {
        resource_action_scope: { resource: 'settings', action: 'read', scope: 'global' },
      },
      create: { resource: 'settings', action: 'read', scope: 'global', description: 'Read settings' },
      update: {},
    }),
    prisma.permission.upsert({
      where: {
        resource_action_scope: { resource: 'settings', action: 'update', scope: 'global' },
      },
      create: { resource: 'settings', action: 'update', scope: 'global', description: 'Update settings' },
      update: {},
    }),
  ])

  const memberRole = await prisma.role.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: 'member' } },
    create: {
      organizationId: org.id,
      name: 'Member',
      slug: 'member',
      description: 'Basic member',
      isSystem: true,
      permissions: {
        create: [
          { permissionId: readPerm.id },
          { permissionId: updatePerm.id },
        ],
      },
    },
    update: {},
    include: { permissions: true },
  })

  const adminRole = await prisma.role.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: 'admin' } },
    create: {
      organizationId: org.id,
      name: 'Admin',
      slug: 'admin',
      description: 'Administrator',
      isSystem: true,
      permissions: {
        create: [
          { permissionId: readPerm.id },
          { permissionId: updatePerm.id },
        ],
      },
    },
    update: {},
  })

  await prisma.team.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: 'teachers' } },
    create: {
      organizationId: org.id,
      name: 'Teachers',
      slug: 'teachers',
      description: 'Teaching staff',
    },
    update: {},
  })

  const passwordHash = await bcrypt.hash('test123', 10)
  await prisma.user.upsert({
    where: {
      organizationId_email: { organizationId: org.id, email: 'admin@demo.com' },
    },
    create: {
      organizationId: org.id,
      email: 'admin@demo.com',
      name: 'Demo Admin',
      firstName: 'Demo',
      lastName: 'Admin',
      passwordHash,
      status: 'ACTIVE',
      roleId: adminRole.id,
    },
    update: { passwordHash, status: 'ACTIVE', roleId: adminRole.id },
  })

  console.log('Seed done: demo org, admin@demo.com (password: test123), member & admin roles')
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
