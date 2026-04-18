/**
 * Centralised access to E2E env vars with friendly errors.
 * Throwing here surfaces config gaps in the test report instead of mysterious 401s.
 */

function require_(name: string): string {
  const value = process.env[name]
  if (!value || value.trim() === '') {
    throw new Error(
      `[e2e] Missing required env var: ${name}\n` +
        `Set it in .env.e2e or pass it via the runner. See .env.e2e.example.`,
    )
  }
  return value
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback
}

export const env = {
  baseUrl: require_('E2E_BASE_URL'),

  orgA: {
    slug: require_('E2E_ORG_A_SLUG'),
    id: require_('E2E_ORG_A_ID'),
    adminEmail: require_('E2E_ADMIN_EMAIL'),
    adminPassword: require_('E2E_ADMIN_PASSWORD'),
    memberEmail: require_('E2E_MEMBER_EMAIL'),
    memberPassword: require_('E2E_MEMBER_PASSWORD'),
  },

  orgB: {
    slug: optional('E2E_ORG_B_SLUG'),
    id: optional('E2E_ORG_B_ID'),
    adminEmail: optional('E2E_ORG_B_ADMIN_EMAIL'),
    adminPassword: optional('E2E_ORG_B_ADMIN_PASSWORD'),
  },

  hasOrgB(): boolean {
    return !!(this.orgB.slug && this.orgB.id && this.orgB.adminEmail && this.orgB.adminPassword)
  },
}
