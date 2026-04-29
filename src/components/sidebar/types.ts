import type { LucideIcon } from 'lucide-react'

export interface SidebarProps {
  userName?: string
  userEmail?: string
  userAvatar?: string
  organizationName?: string
  organizationLogoUrl?: string
  onLogout?: () => void
  onSearchOpen?: () => void
}

export interface CalendarSidebarData {
  id: string
  name: string
  color: string
  calendarType: string
  isActive: boolean
  createdById?: string | null
  campus?: { id: string; name: string } | null
}

export type SettingsTab = 'profile' | 'school-info' | 'roles' | 'teams' | 'users' | 'campus' | 'academic-calendar' | 'approval-config' | 'add-ons' | 'integrations' | 'ticket-routing' | 'activity-log' | 'billing'
export type AthleticsTab = 'overview' | 'manage' | 'schedule' | 'stats'
/** Sub-sections within the Manage tab */
export type AthleticsManageSection = 'sports' | 'teams' | 'roster'
/** Sub-sections within the Schedule tab */
export type AthleticsScheduleSection = 'games' | 'tournaments'
export type MaintenanceTab = 'dashboard' | 'pm-calendar' | 'routing' | 'approvals' | 'forms'

export interface EventProjectSummary {
  id: string
  title: string
  status: string
}

export interface AthleticsCampus {
  id: string
  name: string
  color: string
}

export interface SettingsTabDef {
  id: SettingsTab
  label: string
  icon: LucideIcon
}
