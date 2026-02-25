const base = 'http://127.0.0.1:3004'
const orgId = 'cmlygik30000ysn8mrg0gr3gu'

async function run() {
  const login1 = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@demo.com', password: 'test123', organizationId: orgId }),
  })
  const loginData = await login1.json()
  if (!login1.ok || !loginData.ok) throw new Error(`Admin login failed: ${JSON.stringify(loginData)}`)
  const token = loginData.data.token

  const rolesRes = await fetch(`${base}/api/settings/roles`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const rolesData = await rolesRes.json()
  if (!rolesRes.ok || !rolesData.ok) throw new Error(`Roles failed: ${JSON.stringify(rolesData)}`)
  const memberRole = rolesData.data.find((r) => r.slug === 'member') || rolesData.data[0]

  const email = `newuser_${Date.now()}@demo.com`
  const createRes = await fetch(`${base}/api/settings/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      firstName: 'Flow',
      lastName: 'Test',
      email,
      roleId: memberRole.id,
      teamIds: ['teachers'],
      provisioningMode: 'ADMIN_CREATE',
    }),
  })
  const createData = await createRes.json()
  if (!createRes.ok || !createData.ok) throw new Error(`Create failed: ${JSON.stringify(createData)}`)

  const setupLink = createData.data.setup.setupLink
  const setupToken = new URL(setupLink).searchParams.get('token')
  if (!setupToken) throw new Error('Setup token missing from setup link')

  const validateRes = await fetch(`${base}/api/auth/set-password/validate?token=${encodeURIComponent(setupToken)}`)
  const validateData = await validateRes.json()
  if (!validateRes.ok || !validateData.ok) throw new Error(`Validate failed: ${JSON.stringify(validateData)}`)

  const newPassword = 'NewPass123!'
  const setRes = await fetch(`${base}/api/auth/set-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: setupToken, password: newPassword }),
  })
  const setData = await setRes.json()
  if (!setRes.ok || !setData.ok) throw new Error(`Set password failed: ${JSON.stringify(setData)}`)

  const login2 = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: newPassword, organizationId: orgId }),
  })
  const login2Data = await login2.json()
  if (!login2.ok || !login2Data.ok) throw new Error(`New user login failed: ${JSON.stringify(login2Data)}`)

  console.log('E2E PASS', { email, setupLink })
}

run().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
