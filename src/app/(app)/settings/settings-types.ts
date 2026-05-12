/**
 * Settings page types, tab definitions, and URL helpers.
 */

export type Tab =
  | 'profile'
  | 'notifications'
  | 'school-info'
  | 'roles'
  | 'teams'
  | 'users'
  | 'campus'
  | 'academic-calendar'
  | 'approval-config'
  | 'add-ons'
  | 'integrations'
  | 'sso'
  | 'activity-log'
  | 'billing'

export const VALID_TABS: Tab[] = [
  'profile',
  'notifications',
  'school-info',
  'roles',
  'teams',
  'users',
  'campus',
  'academic-calendar',
  'approval-config',
  'add-ons',
  'integrations',
  'sso',
  'activity-log',
  'billing',
]

export type WorkspaceTab = Exclude<Tab, 'profile'>

/**
 * F-008: deep-link aliases.
 *
 * The sidebar shows nice labels ("Members", "Facilities") while the URL uses
 * the canonical internal keys ("users", "campus"). Without these aliases,
 * direct links like /settings?tab=members render a blank panel because the
 * label-name doesn't match any key in VALID_TABS. Mapping label → canonical
 * lets either form work.
 */
const TAB_ALIASES: Record<string, Tab> = {
  members: 'users',
  facilities: 'campus',
  approval: 'approval-config',
  'school-information': 'school-info',
  schoolinfo: 'school-info',
  audit: 'activity-log',
  'audit-log': 'activity-log',
  activity: 'activity-log',
  security: 'sso',
  saml: 'sso',
  addons: 'add-ons',
}

export function resolveTab(raw: string | null | undefined): Tab | null {
  if (!raw) return null
  const lower = raw.toLowerCase().trim()
  // Canonical match first
  if ((VALID_TABS as readonly string[]).includes(lower)) return lower as Tab
  // Then aliases
  return TAB_ALIASES[lower] ?? null
}

export function getInitialTab(): Tab {
  if (typeof window === 'undefined') return 'profile'
  const params = new URLSearchParams(window.location.search)
  const tab = resolveTab(params.get('tab'))
  return tab ?? 'profile'
}
