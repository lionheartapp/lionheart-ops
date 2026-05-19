import {
  User,
  Bell,
  School,
  Shield,
  Users,
  UserCog,
  Building2,
  Puzzle,
  Link2,
  ScrollText,
  CreditCard,
  Home,
  CalendarDays,
  Route,
  KeyRound,
} from 'lucide-react'
import type { SettingsTabDef } from './types'

export const COLOR_PRESETS = [
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Slate', value: '#6a6864' },
] as const

export const DEFAULT_CAMPUS_COLORS = ['#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ef4444', '#14b8a6'] as const

export const GENERAL_TABS: SettingsTabDef[] = [
  { id: 'profile', label: 'My Profile', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
]

// ── Grouped workspace tabs ──────────────────────────────────────────────────
// Each group gets a small section header in the sidebar. This replaces the
// old flat WORKSPACE_TABS array.

export interface SettingsTabGroup {
  label: string
  tabs: SettingsTabDef[]
}

export const WORKSPACE_GROUPS: SettingsTabGroup[] = [
  {
    label: 'Organization',
    tabs: [
      { id: 'school-info', label: 'Organization', icon: School },
      { id: 'campus', label: 'Facilities', icon: Building2 },
    ],
  },
  {
    label: 'People',
    tabs: [
      { id: 'users', label: 'Members', icon: UserCog },
      { id: 'teams', label: 'Teams', icon: Users },
      { id: 'roles', label: 'Roles', icon: Shield },
    ],
  },
  {
    label: 'Billing & Apps',
    tabs: [
      { id: 'billing', label: 'Billing', icon: CreditCard },
      { id: 'add-ons', label: 'Add-ons', icon: Puzzle },
      { id: 'integrations', label: 'Integrations', icon: Link2 },
    ],
  },
  {
    label: 'Security',
    tabs: [
      { id: 'sso', label: 'Single Sign-On', icon: KeyRound },
      { id: 'activity-log', label: 'Activity Log', icon: ScrollText },
    ],
  },
]

/** Flat list of all workspace tabs — for backwards compat with code that
 *  iterates the old WORKSPACE_TABS array. */
export const WORKSPACE_TABS: SettingsTabDef[] = WORKSPACE_GROUPS.flatMap((g) => g.tabs)

export const NAV_ITEMS = [
  { icon: Home, label: 'Dashboard', href: '/dashboard' },
] as const
