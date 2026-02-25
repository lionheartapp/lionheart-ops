import { PrismaClient } from '@prisma/client'

const base = 'http://127.0.0.1:3004'
const prisma = new PrismaClient()

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function json(res) {
  const data = await res.json()
  return data
}

async function step(name, fn) {
  process.stdout.write(`- ${name} ... `)
  await fn()
  process.stdout.write('OK\n')
}

async function run() {
  const org = await prisma.organization.findFirst({ where: { slug: 'demo' }, select: { id: true, name: true } })
  assert(org?.id, 'Demo organization not found')

  const orgId = org.id
  let adminToken = ''
  let memberRoleId = ''
  let createdActiveEmail = ''
  let createdPendingEmail = ''
  let createdPendingSetupToken = ''
  let createdPendingUserId = ''

  await step('Health check root', async () => {
    const res = await fetch(base)
    assert(res.ok, `Health failed: ${res.status}`)
  })

  await step('Admin login', async () => {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@demo.com', password: 'test123', organizationId: orgId }),
    })
    const data = await json(res)
    assert(res.ok && data.ok, `Admin login failed: ${JSON.stringify(data)}`)
    adminToken = data.data.token
    assert(typeof adminToken === 'string' && adminToken.length > 20, 'Admin token missing')
  })

  await step('Roles API', async () => {
    const res = await fetch(`${base}/api/settings/roles`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const data = await json(res)
    assert(res.ok && data.ok, `Roles failed: ${JSON.stringify(data)}`)
    assert(Array.isArray(data.data) && data.data.length > 0, 'Roles empty')
    const member = data.data.find((r) => r.slug === 'member')
    assert(member?.id, 'Member role missing')
    memberRoleId = member.id
  })

  await step('Teams API', async () => {
    const res = await fetch(`${base}/api/settings/teams`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const data = await json(res)
    assert(res.ok && data.ok, `Teams failed: ${JSON.stringify(data)}`)
    assert(Array.isArray(data.data) && data.data.length > 0, 'Teams empty')
  })

  await step('Permissions API', async () => {
    const res = await fetch(`${base}/api/settings/permissions`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const data = await json(res)
    assert(res.ok && data.ok, `Permissions failed: ${JSON.stringify(data)}`)
    assert(Array.isArray(data.data) && data.data.length > 0, 'Permissions empty')
  })

  await step('Users API list', async () => {
    const res = await fetch(`${base}/api/settings/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const data = await json(res)
    assert(res.ok && data.ok, `Users list failed: ${JSON.stringify(data)}`)
    assert(Array.isArray(data.data), 'Users list invalid')
  })

  await step('Create ACTIVE member (ADMIN_CREATE)', async () => {
    createdActiveEmail = `smoke_active_${Date.now()}@demo.com`
    const res = await fetch(`${base}/api/settings/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        firstName: 'Smoke',
        lastName: 'Active',
        email: createdActiveEmail,
        roleId: memberRoleId,
        teamIds: ['teachers'],
        employmentType: 'FULL_TIME',
        provisioningMode: 'ADMIN_CREATE',
      }),
    })
    const data = await json(res)
    assert(res.ok && data.ok, `Create ACTIVE failed: ${JSON.stringify(data)}`)
    assert(data.data?.user?.status === 'ACTIVE', 'Created ACTIVE user not active')
    assert(typeof data.data?.setup?.setupLink === 'string', 'Missing setup link')
  })

  await step('Create PENDING member (INVITE_ONLY)', async () => {
    createdPendingEmail = `smoke_pending_${Date.now()}@demo.com`
    const res = await fetch(`${base}/api/settings/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        firstName: 'Smoke',
        lastName: 'Pending',
        email: createdPendingEmail,
        roleId: memberRoleId,
        teamIds: ['teachers'],
        employmentType: 'PART_TIME',
        provisioningMode: 'INVITE_ONLY',
      }),
    })
    const data = await json(res)
    assert(res.ok && data.ok, `Create PENDING failed: ${JSON.stringify(data)}`)
    assert(data.data?.user?.status === 'PENDING', 'Created pending user not pending')
    createdPendingUserId = data.data.user.id
    const setupLink = data.data.setup.setupLink
    createdPendingSetupToken = new URL(setupLink).searchParams.get('token') || ''
    assert(createdPendingSetupToken.length > 0, 'Missing pending setup token')
  })

  await step('Set-password validate token', async () => {
    const res = await fetch(`${base}/api/auth/set-password/validate?token=${encodeURIComponent(createdPendingSetupToken)}`)
    const data = await json(res)
    assert(res.ok && data.ok, `Validate token failed: ${JSON.stringify(data)}`)
    assert(data.data?.valid === true, 'Token not valid')
  })

  await step('Set password for pending user', async () => {
    const res = await fetch(`${base}/api/auth/set-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: createdPendingSetupToken, password: 'SmokePass123!' }),
    })
    const data = await json(res)
    assert(res.ok && data.ok, `Set password failed: ${JSON.stringify(data)}`)
  })

  await step('Pending user login blocked', async () => {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: createdPendingEmail, password: 'SmokePass123!', organizationId: orgId }),
    })
    const data = await json(res)
    assert(res.status === 401 && data.ok === false, 'Pending user should be blocked from login')
  })

  await step('User detail GET', async () => {
    const res = await fetch(`${base}/api/settings/users/${createdPendingUserId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const data = await json(res)
    assert(res.ok && data.ok, `User detail failed: ${JSON.stringify(data)}`)
  })

  await step('User PATCH (activate pending)', async () => {
    const res = await fetch(`${base}/api/settings/users/${createdPendingUserId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'ACTIVE', jobTitle: 'Teacher Aide' }),
    })
    const data = await json(res)
    assert(res.ok && data.ok, `User patch failed: ${JSON.stringify(data)}`)
    assert(data.data?.status === 'ACTIVE', 'User not activated')
  })

  await step('Activated user login succeeds', async () => {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: createdPendingEmail, password: 'SmokePass123!', organizationId: orgId }),
    })
    const data = await json(res)
    assert(res.ok && data.ok, `Activated user login failed: ${JSON.stringify(data)}`)
  })

  console.log('\nSmoke test suite passed.')
  console.log(JSON.stringify({ orgId, createdActiveEmail, createdPendingEmail }, null, 2))
}

run()
  .catch((error) => {
    console.error(`\nSmoke test failed: ${error.message}`)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
