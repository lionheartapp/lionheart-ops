import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3004'
const preferredOrgSlug = process.env.SMOKE_ORG_SLUG || 'demo'

async function req(path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, options)
  let json = null
  try {
    json = await res.json()
  } catch {}
  return { res, json }
}

async function resolveOrganizationId() {
  const preferred = await prisma.organization.findFirst({
    where: { slug: preferredOrgSlug },
    select: { id: true },
  })

  if (preferred) return preferred.id

  const fallback = await prisma.organization.findFirst({ select: { id: true } })
  if (!fallback) {
    throw new Error('No organization found in database for smoke test')
  }

  return fallback.id
}

async function ensurePermission(resource, action, createdPermissionIds) {
  let permission = await prisma.permission.findUnique({
    where: {
      resource_action_scope: {
        resource,
        action,
        scope: 'global',
      },
    },
  })

  if (!permission) {
    permission = await prisma.permission.create({
      data: {
        resource,
        action,
        scope: 'global',
        description: `Temporary smoke permission ${resource}:${action}:global`,
      },
    })
    createdPermissionIds.push(permission.id)
  }

  return permission
}

async function createSmokeUser(organizationId, kind, createdPermissionIds) {
  const email = `smoke+settings-${kind}-${Date.now()}@example.com`
  const password = 'Smoke123!'
  const passwordHash = await bcrypt.hash(password, 10)

  const permissionPairs =
    kind === 'manager'
      ? [
          ['settings', 'read'],
          ['settings', 'update'],
          ['roles', 'read'],
          ['roles', 'create'],
          ['teams', 'read'],
          ['teams', 'create'],
          ['users', 'read'],
          ['users', 'invite'],
        ]
      : [['settings', 'read']]

  const permissionIds = []
  for (const [resource, action] of permissionPairs) {
    const permission = await ensurePermission(resource, action, createdPermissionIds)
    permissionIds.push(permission.id)
  }

  const role = await prisma.role.create({
    data: {
      organizationId,
      name: `Smoke Settings ${kind} ${Date.now()}`,
      slug: `smoke-settings-${kind}-${Date.now()}`,
      description: `Temporary ${kind} role for settings permission smoke`,
      isSystem: false,
      permissions: {
        create: permissionIds.map((permissionId) => ({ permissionId })),
      },
    },
  })

  const user = await prisma.user.create({
    data: {
      organizationId,
      email,
      firstName: 'Smoke',
      lastName: kind,
      name: `Smoke ${kind}`,
      passwordHash,
      status: 'ACTIVE',
      roleId: role.id,
      role: kind === 'manager' ? 'ADMIN' : 'VIEWER',
      schoolScope: 'GLOBAL',
      teamIds: [],
    },
  })

  return {
    userId: user.id,
    roleId: role.id,
    email,
    password,
  }
}

async function login(email, password, organizationId) {
  const result = await req('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, organizationId }),
  })

  if (!result.res.ok || !result.json?.ok || !result.json?.data?.token) {
    throw new Error(`Login failed for ${email}: ${result.res.status} ${JSON.stringify(result.json)}`)
  }

  return result.json.data.token
}

async function main() {
  let manager = null
  let readonly = null
  const createdPermissionIds = []

  try {
    const organizationId = await resolveOrganizationId()
    manager = await createSmokeUser(organizationId, 'manager', createdPermissionIds)
    readonly = await createSmokeUser(organizationId, 'readonly', createdPermissionIds)

    const managerToken = await login(manager.email, manager.password, organizationId)
    const readonlyToken = await login(readonly.email, readonly.password, organizationId)

    const managerPermissions = await req('/api/auth/permissions', {
      headers: { Authorization: `Bearer ${managerToken}` },
    })
    const readonlyPermissions = await req('/api/auth/permissions', {
      headers: { Authorization: `Bearer ${readonlyToken}` },
    })

    const managerRoles = await req('/api/settings/roles', {
      headers: {
        Authorization: `Bearer ${managerToken}`,
        'X-Organization-ID': organizationId,
      },
    })

    const readonlyRoles = await req('/api/settings/roles', {
      headers: {
        Authorization: `Bearer ${readonlyToken}`,
        'X-Organization-ID': organizationId,
      },
    })

    if (managerPermissions.json?.data?.canManageWorkspace !== true) {
      throw new Error(`Expected manager canManageWorkspace=true, got ${JSON.stringify(managerPermissions.json)}`)
    }

    if (readonlyPermissions.json?.data?.canManageWorkspace !== false) {
      throw new Error(`Expected readonly canManageWorkspace=false, got ${JSON.stringify(readonlyPermissions.json)}`)
    }

    if (managerRoles.res.status !== 200) {
      throw new Error(`Expected manager roles read 200, got ${managerRoles.res.status}`)
    }

    if (readonlyRoles.res.status !== 403) {
      throw new Error(`Expected readonly roles read 403, got ${readonlyRoles.res.status}`)
    }

    console.log('✅ Settings permission smoke passed')
    console.log(
      JSON.stringify(
        {
          organizationId,
          checks: {
            managerCanManageWorkspace: managerPermissions.json?.data?.canManageWorkspace,
            readonlyCanManageWorkspace: readonlyPermissions.json?.data?.canManageWorkspace,
            managerRolesReadStatus: managerRoles.res.status,
            readonlyRolesReadStatus: readonlyRoles.res.status,
          },
        },
        null,
        2
      )
    )
  } finally {
    if (manager?.userId) {
      await prisma.user.delete({ where: { id: manager.userId } }).catch(() => {})
    }
    if (manager?.roleId) {
      await prisma.role.delete({ where: { id: manager.roleId } }).catch(() => {})
    }
    if (readonly?.userId) {
      await prisma.user.delete({ where: { id: readonly.userId } }).catch(() => {})
    }
    if (readonly?.roleId) {
      await prisma.role.delete({ where: { id: readonly.roleId } }).catch(() => {})
    }

    if (createdPermissionIds.length > 0) {
      await prisma.permission
        .deleteMany({
          where: {
            id: {
              in: createdPermissionIds,
            },
          },
        })
        .catch(() => {})
    }

    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('❌ Settings permission smoke failed:', error.message)
  process.exit(1)
})
