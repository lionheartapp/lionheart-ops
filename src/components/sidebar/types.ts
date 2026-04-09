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

export type SettingsTab = 'profile' | 'school-info' | 'roles' | 'teams' | 'users' | 'campus' | 'academic-calendar' | 'approval-config' | 'add-ons' | 'integrations' | 'activity-log' | 'billing'
export type AthleticsTab = 'overview' | 'sports' | 'teams' | 'schedule' | 'roster' | 'tournaments' | 'stats'
export type MaintenanceTab = 'dashboard' | 'pm-calendar'

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
