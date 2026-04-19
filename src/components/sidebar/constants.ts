import {
  User,
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
  ClipboardCheck,
  Route,
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
]

export const WORKSPACE_TABS: SettingsTabDef[] = [
  { id: 'school-info', label: 'School Information', icon: School },
  { id: 'roles', label: 'Roles', icon: Shield },
  { id: 'teams', label: 'Teams', icon: Users },
  { id: 'users', label: 'Members', icon: UserCog },
  { id: 'campus', label: 'Campus', icon: Building2 },
  { id: 'academic-calendar', label: 'Academic Calendar', icon: CalendarDays },
  { id: 'approval-config', label: 'Approval Config', icon: ClipboardCheck },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'add-ons', label: 'Add-ons', icon: Puzzle },
  { id: 'integrations', label: 'Integrations', icon: Link2 },
  { id: 'activity-log', label: 'Activity Log', icon: ScrollText },
]

export const NAV_ITEMS = [
  { icon: Home, label: 'Dashboard', href: '/dashboard' },
] as const
