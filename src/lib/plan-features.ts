/**
 * Plan feature label + formatter helpers.
 *
 * Feature keys on SubscriptionPlan.features are camelCase with preserved
 * acronyms (e.g. `fullITSuite`, `ssoSaml`, `dedicatedCSM`). A naive
 * camelCase-to-space transform mangles them into "Full I T Suite" and
 * "Sso Saml". This module is the single source of truth for human labels,
 * hidden/internal keys, and per-key formatting.
 *
 * Used by both the onboarding/plan picker page and the settings → billing
 * tab so the two renderers stay in sync.
 */

/** Feature keys that are never surfaced to end users (internal flags / metadata). */
export const HIDDEN_FEATURE_KEYS = new Set(['mostPopular', '_note'])

/**
 * Explicit human labels for feature keys. Acronyms must stay glued
 * together (IT, A/V, SSO, SAML, CSM, SLA, API).
 */
export const FEATURE_LABELS: Record<string, string> = {
  campuses: 'Campuses',
  aiActionsPerMonth: 'AI actions / month',
  calendaring: 'Calendaring',
  eventPlanning: 'Event planning',
  maintenanceTickets: 'Maintenance tickets',
  itTickets: 'IT tickets',
  avRequests: 'A/V requests',
  roomManagement: 'Room management',
  systemRoles: 'System roles',
  standardReporting: 'Standard reporting',
  emailSupport: 'Email support',
  everythingInEssentials: 'Everything in Essentials',
  fullMaintenanceSuite: 'Full maintenance suite',
  fullITSuite: 'Full IT suite',
  fullAVSuite: 'Full A/V suite',
  googleCalendarSync: 'Google Calendar sync',
  outlookCalendarSync: 'Outlook Calendar sync',
  customRolesAndPermissions: 'Custom roles & permissions',
  advancedReporting: 'Advanced reporting',
  prioritySupport: 'Priority support',
  everythingInPro: 'Everything in Pro',
  ssoSaml: 'SSO / SAML',
  auditLogs: 'Audit logs',
  apiAccess: 'API access',
  customPermissionScopes: 'Custom permission scopes',
  whiteLabel: 'White label',
  dedicatedCSM: 'Dedicated CSM',
  uptimeSLA: 'Uptime SLA',
  quarterlyBusinessReviews: 'Quarterly business reviews',
  phoneSupport: 'Phone support',
  additionalCampusPrice: 'Additional campus',
}

/** Fallback splitter for keys not in FEATURE_LABELS. */
export function humanizeFeatureKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim()
}

function formatCentsToDollars(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString('en-US')}`
}

export function formatFeatureRow(key: string, value: unknown): string {
  const label = FEATURE_LABELS[key] ?? humanizeFeatureKey(key)

  // Custom-formatted keys
  if (key === 'additionalCampusPrice' && typeof value === 'number') {
    return `${label}: ${formatCentsToDollars(value)}/yr`
  }
  if (key === 'aiActionsPerMonth') {
    if (value === 'unlimited') return 'Unlimited AI actions / month'
    return `${label}: ${value}`
  }
  if (key === 'campuses' && typeof value === 'number') {
    return value === 1 ? '1 campus included' : `${value} campuses included`
  }
  if (key === 'uptimeSLA' && typeof value === 'string') {
    return `${label}: ${value}`
  }

  if (typeof value === 'boolean') return value ? label : ''
  if (typeof value === 'number') return `${label}: ${value.toLocaleString('en-US')}`
  if (typeof value === 'string') return `${label}: ${value}`
  return ''
}

export function getFeatureList(features: Record<string, unknown> | null | undefined): string[] {
  if (!features) return []
  return Object.entries(features)
    .filter(([key]) => !HIDDEN_FEATURE_KEYS.has(key))
    .map(([key, value]) => formatFeatureRow(key, value))
    .filter(Boolean)
}

/** True when the plan should be rendered as a "Contact sales" card (no self-serve checkout). */
export function isEnterprisePlan(plan: { slug: string }): boolean {
  return plan.slug.toLowerCase().includes('enterprise')
}
