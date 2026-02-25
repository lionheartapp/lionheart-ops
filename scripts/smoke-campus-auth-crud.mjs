import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const baseUrl = 'http://127.0.0.1:3004'
let organizationId = ''

async function req(path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, options)
  let json = null
  try { json = await res.json() } catch {}
  return { res, json }
}

async function ensureSmokeUser() {
  if (!organizationId) {
    throw new Error('organizationId not resolved')
  }
  const ts = Date.now().toString().slice(-8)
  const email = `smoke+${ts}@linfield.com`
  const password = 'Smoke123!'
  const passwordHash = await bcrypt.hash(password, 10)
  const smokeRoleSlug = `smoke-campus-${ts}`

  let createdRoleId = null
  let createdPermissionIds = []

  const ensurePermission = async (resource, action, scope = 'global') => {
    let permission = await prisma.permission.findUnique({
      where: {
        resource_action_scope: {
          resource,
          action,
          scope,
        },
      },
    })

    if (!permission) {
      permission = await prisma.permission.create({
        data: {
          resource,
          action,
          scope,
          description: `Temporary smoke permission ${resource}:${action}:${scope}`,
        },
      })
      createdPermissionIds.push(permission.id)
    }

    return permission
  }

  const readPermission = await ensurePermission('settings', 'read')
  const updatePermission = await ensurePermission('settings', 'update')

  const role = await prisma.role.create({
    data: {
      organizationId,
      name: `Smoke Campus Role ${ts}`,
      slug: smokeRoleSlug,
      description: 'Temporary role for campus API smoke tests',
      isSystem: false,
      permissions: {
        create: [
          { permissionId: readPermission.id },
          { permissionId: updatePermission.id },
        ],
      },
    },
  })
  createdRoleId = role.id

  const user = await prisma.user.create({
    data: {
      organizationId,
      email,
      firstName: 'Smoke',
      lastName: 'Tester',
      name: 'Smoke Tester',
      passwordHash,
      status: 'ACTIVE',
      roleId: role.id,
      role: 'ADMIN',
      schoolScope: 'GLOBAL',
      teamIds: [],
    },
  })

  return {
    userId: user.id,
    email,
    password,
    roleName: role.name,
    roleId: createdRoleId,
    createdPermissionIds,
  }
}

async function runSmoke(email, password) {
  if (!organizationId) {
    throw new Error('organizationId not resolved')
  }

  const login = await req('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, organizationId }),
  })

  if (!login.res.ok || !login.json?.ok || !login.json?.data?.token) {
    throw new Error(`Login failed: ${login.res.status} ${JSON.stringify(login.json)}`)
  }

  const token = login.json.data.token
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'X-Organization-ID': organizationId,
    'Content-Type': 'application/json',
  }

  const ts = Date.now().toString().slice(-6)
  const buildingName = `Smoke Building ${ts}`
  const areaName = `Smoke Area ${ts}`
  const roomNumber = `S-${ts}`

  const createBuilding = await req('/api/settings/campus/buildings', {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({ name: buildingName, code: `SB${ts}`, schoolDivision: 'GLOBAL' }),
  })
  if (!createBuilding.res.ok || !createBuilding.json?.ok) {
    throw new Error(`Create building failed: ${createBuilding.res.status} ${JSON.stringify(createBuilding.json)}`)
  }
  const buildingId = createBuilding.json.data.id

  const createArea = await req('/api/settings/campus/areas', {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({ name: areaName, areaType: 'COMMON', buildingId }),
  })
  if (!createArea.res.ok || !createArea.json?.ok) {
    throw new Error(`Create area failed: ${createArea.res.status} ${JSON.stringify(createArea.json)}`)
  }
  const areaId = createArea.json.data.id

  const createRoom = await req('/api/settings/campus/rooms', {
    method: 'POST', headers: authHeaders,
    body: JSON.stringify({ buildingId, areaId, roomNumber, displayName: 'Smoke Room', floor: '1' }),
  })
  if (!createRoom.res.ok || !createRoom.json?.ok) {
    throw new Error(`Create room failed: ${createRoom.res.status} ${JSON.stringify(createRoom.json)}`)
  }
  const roomId = createRoom.json.data.id

  const patchRoom = await req(`/api/settings/campus/rooms/${roomId}`, {
    method: 'PATCH', headers: authHeaders,
    body: JSON.stringify({ displayName: 'Smoke Room Updated', floor: '2' }),
  })
  if (!patchRoom.res.ok || !patchRoom.json?.ok) {
    throw new Error(`Patch room failed: ${patchRoom.res.status} ${JSON.stringify(patchRoom.json)}`)
  }

  const deleteRoom = await req(`/api/settings/campus/rooms/${roomId}`, { method: 'DELETE', headers: authHeaders })
  if (!deleteRoom.res.ok || !deleteRoom.json?.ok) {
    throw new Error(`Delete room failed: ${deleteRoom.res.status} ${JSON.stringify(deleteRoom.json)}`)
  }

  const roomsWithInactive = await req('/api/settings/campus/rooms?includeInactive=true', { headers: authHeaders })
  if (!roomsWithInactive.res.ok || !roomsWithInactive.json?.ok) {
    throw new Error(`List rooms failed: ${roomsWithInactive.res.status} ${JSON.stringify(roomsWithInactive.json)}`)
  }
  const deletedRoom = (roomsWithInactive.json.data || []).find((r) => r.id === roomId)
  if (!deletedRoom || deletedRoom.isActive !== false) {
    throw new Error('Soft delete verification failed for room')
  }

  const deleteArea = await req(`/api/settings/campus/areas/${areaId}`, { method: 'DELETE', headers: authHeaders })
  if (!deleteArea.res.ok || !deleteArea.json?.ok) {
    throw new Error(`Delete area failed: ${deleteArea.res.status} ${JSON.stringify(deleteArea.json)}`)
  }

  const deleteBuilding = await req(`/api/settings/campus/buildings/${buildingId}`, { method: 'DELETE', headers: authHeaders })
  if (!deleteBuilding.res.ok || !deleteBuilding.json?.ok) {
    throw new Error(`Delete building failed: ${deleteBuilding.res.status} ${JSON.stringify(deleteBuilding.json)}`)
  }

  const campusLookup = await req('/api/campus/lookup', { headers: authHeaders })
  if (!campusLookup.res.ok || !campusLookup.json?.ok) {
    throw new Error(`Campus lookup failed: ${campusLookup.res.status} ${JSON.stringify(campusLookup.json)}`)
  }

  return {
    checks: {
      login: login.res.status,
      createBuilding: createBuilding.res.status,
      createArea: createArea.res.status,
      createRoom: createRoom.res.status,
      patchRoom: patchRoom.res.status,
      deleteRoom: deleteRoom.res.status,
      deleteArea: deleteArea.res.status,
      deleteBuilding: deleteBuilding.res.status,
      campusLookup: campusLookup.res.status,
      roomSoftDeleted: deletedRoom.isActive === false,
    },
  }
}

async function main() {
  let smokeUser = null
  try {
    const org = await prisma.organization.findFirst({
      where: { slug: 'demo' },
      select: { id: true },
    })

    if (!org) {
      const fallbackOrg = await prisma.organization.findFirst({ select: { id: true } })
      if (!fallbackOrg) {
        throw new Error('No organization found in database for smoke test')
      }
      organizationId = fallbackOrg.id
    } else {
      organizationId = org.id
    }

    smokeUser = await ensureSmokeUser()
    const result = await runSmoke(smokeUser.email, smokeUser.password)
    console.log('✅ Authenticated campus CRUD smoke passed')
    console.log(JSON.stringify({ smokeUserRole: smokeUser.roleName, ...result }, null, 2))
  } finally {
    if (smokeUser?.userId) {
      await prisma.user.delete({ where: { id: smokeUser.userId } }).catch(() => {})
    }
    if (smokeUser?.roleId) {
      await prisma.role.delete({ where: { id: smokeUser.roleId } }).catch(() => {})
    }
    if (Array.isArray(smokeUser?.createdPermissionIds) && smokeUser.createdPermissionIds.length > 0) {
      await prisma.permission.deleteMany({
        where: {
          id: {
            in: smokeUser.createdPermissionIds,
          },
        },
      }).catch(() => {})
    }
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error('❌ Smoke failed:', err.message)
  process.exit(1)
})
