const base = 'http://127.0.0.1:3004'
const orgId = 'cmlygik30000ysn8mrg0gr3gu'

async function run() {
  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@demo.com', password: 'test123', organizationId: orgId }),
  })
  const loginData = await login.json()
  if (!login.ok || !loginData.ok) throw new Error('Login failed')

  const rolesRes = await fetch(`${base}/api/settings/roles`, {
    headers: { Authorization: `Bearer ${loginData.data.token}` },
  })
  const rolesData = await rolesRes.json()
  if (!rolesRes.ok || !rolesData.ok) throw new Error('Roles fetch failed')

  const role = rolesData.data.find((r) => r.slug === 'member') || rolesData.data[0]
  const email = `providercheck_${Date.now()}@demo.com`

  const createRes = await fetch(`${base}/api/settings/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${loginData.data.token}`,
    },
    body: JSON.stringify({
      firstName: 'Provider',
      lastName: 'Check',
      email,
      roleId: role.id,
      teamIds: ['teachers'],
      provisioningMode: 'INVITE_ONLY',
    }),
  })

  const data = await createRes.json()
  if (!createRes.ok || !data.ok) throw new Error(`Create failed: ${JSON.stringify(data)}`)

  console.log(JSON.stringify({
    emailSent: data.data.setup.emailSent,
    emailReason: data.data.setup.emailReason,
  }, null, 2))
}

run().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
