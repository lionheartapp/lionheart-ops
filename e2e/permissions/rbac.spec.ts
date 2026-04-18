import { test, expect } from '@playwright/test'
import { ApiClient, assertFail } from '../helpers/api'
import { env } from '../helpers/env'
import { userEmail } from '../helpers/data'

/**
 * RBAC boundary checks — a "member" role must not perform admin actions.
 * Add a new test here every time you add a new permission.
 */

test.describe('RBAC · member role is blocked from admin actions', () => {
  test('member cannot invite a user (users:invite)', async () => {
    const member = await ApiClient.login({
      email: env.orgA.memberEmail,
      password: env.orgA.memberPassword,
      organizationId: env.orgA.id,
    })

    const { status, body } = await member.post('/api/settings/users', {
      email: userEmail('rbac-probe'),
      name: 'Should Never Exist',
      roleId: null, // server should reject before this matters
    })
    expect([401, 403], `member was allowed to invite! status=${status}`).toContain(status)
    if (body && !('ok' in body && (body as { ok: true }).ok)) {
      // Accept either FORBIDDEN or a more specific code.
      expect(body).toHaveProperty('error.code')
    }
    await member.dispose()
  })

  test('member cannot create a role (roles:manage)', async () => {
    const member = await ApiClient.login({
      email: env.orgA.memberEmail,
      password: env.orgA.memberPassword,
      organizationId: env.orgA.id,
    })

    const { status } = await member.post('/api/settings/roles', {
      name: 'e2e-rbac-should-not-create',
    })
    expect([401, 403]).toContain(status)
    await member.dispose()
  })

  test('member cannot delete the org (owner/super-admin only)', async () => {
    const member = await ApiClient.login({
      email: env.orgA.memberEmail,
      password: env.orgA.memberPassword,
      organizationId: env.orgA.id,
    })

    const { status } = await member.post('/api/settings/organization/delete', {
      confirm: env.orgA.slug,
    })
    expect([401, 403]).toContain(status)
    await member.dispose()
  })
})

test.describe('RBAC · admin is allowed', () => {
  test('admin can list users and roles', async () => {
    const admin = await ApiClient.login({
      email: env.orgA.adminEmail,
      password: env.orgA.adminPassword,
      organizationId: env.orgA.id,
    })

    for (const route of ['/api/settings/users', '/api/settings/roles', '/api/settings/permissions']) {
      const { status, body } = await admin.get(route)
      expect(status, `${route} returned ${status}: ${JSON.stringify(body)}`).toBeLessThan(400)
    }
    await admin.dispose()
  })
})
