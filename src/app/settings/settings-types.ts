/**
 * Settings page types, tab definitions, and URL helpers.
 */

export type Tab =
  | 'profile'
  | 'school-info'
  | 'roles'
  | 'teams'
  | 'users'
  | 'campus'
  | 'academic-calendar'
  | 'approval-config'
  | 'add-ons'
  | 'integrations'
  | 'activity-log'
  | 'billing'
  | 'ticket-routing'

export const VALID_TABS: Tab[] = [
  'profile',
  'school-info',
  'roles',
  'teams',
  'users',
  'campus',
  'academic-calendar',
  'approval-config',
  'add-ons',
  'integrations',
  'activity-log',
  'billing',
  'ticket-routing',
]

export type WorkspaceTab = Exclude<Tab, 'profile'>

export function getInitialTab(): Tab {
  if (typeof window === 'undefined') return 'profile'
  const params = new URLSearchParams(window.location.search)
  const tab = params.get('tab') as Tab | null
  if (tab && VALID_TABS.includes(tab)) return tab
  return 'profile'
}
