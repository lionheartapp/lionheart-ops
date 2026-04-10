/**
 * Onboarding Checklist Service
 *
 * Single source of truth for what the "Get Started" checklist shows a
 * first-time user. State is *derived* from the database on every request —
 * there is no stored completion table — so a task can never drift from
 * reality. If the admin adds then deletes their first building, the
 * "Set up your campus" task correctly un-completes itself.
 *
 * The only stored flags are:
 *   • Organization.onboardingDismissedItems — per-item dismissals (admin only)
 *   • User.onboardingDismissedItems — per-item dismissals (per user)
 *
 * Dismissals only apply to items where `dismissable: true`. Essential
 * workspace items cannot be dismissed — the platform is not functional
 * until they are completed.
 */

import { rawPrisma } from '@/lib/db'

// ─── Types ───────────────────────────────────────────────────────────────────

export type ChecklistCategory =
  | 'workspace'
  | 'module'
  | 'integration'
  | 'billing'
  | 'profile'

export interface ChecklistItem {
  /** Stable string id — used for dismissal + client-side filtering. */
  id: string
  /** Short action-oriented label. */
  title: string
  /** Two-line supporting copy explaining what the task achieves. */
  description: string
  /**
   * True if this item blocks the platform from being useful. Required items
   * are rendered with a red indicator and cannot be dismissed. Non-required
   * items are rendered neutrally and can be dismissed.
   */
  required: boolean
  category: ChecklistCategory
  /** Which product module this item belongs to, if any. */
  module?: 'maintenance' | 'it' | 'events' | 'athletics' | 'academic'
  /** URL the user lands on when they click the item. */
  href: string
  /** True when the derivation query confirms the task is done. */
  completed: boolean
  /** Set by the dismissal flag — filtered out of the response by default. */
  dismissed: boolean
  /** False for essentials so the UI hides the dismiss button. */
  dismissable: boolean
}

export interface ChecklistResponse {
  items: ChecklistItem[]
  essentialComplete: boolean
  totalCount: number
  completedCount: number
  requiredCount: number
  requiredCompleted: number
  /** True once the admin has dismissed the dashboard widget (only allowed post-essentials). */
  widgetDismissed: boolean
}

// ─── Org-level (super admin) checklist ───────────────────────────────────────

/**
 * Derive the full org-level checklist for a super admin. Runs all the
 * count + field-population queries in parallel so the whole thing is one
 * DB round trip.
 */
export async function getOrgChecklist(orgId: string): Promise<ChecklistResponse> {
  const [
    org,
    userCount,
    memberWithRoleCount,
    buildingCount,
    roomCount,
    assetCount,
    pmScheduleCount,
    deviceCount,
    nonPersonalCalendarCount,
    approvalConfigCount,
    sportCount,
    athleticTeamCount,
    academicYearCount,
  ] = await Promise.all([
    rawPrisma.organization.findUnique({
      where: { id: orgId },
      select: {
        gradeRange: true,
        studentCount: true,
        physicalAddress: true,
        logoUrl: true,
        onboardingDismissedItems: true,
        onboardingWidgetDismissedAt: true,
      },
    }),
    rawPrisma.user.count({ where: { organizationId: orgId } }),
    rawPrisma.user.count({
      where: {
        organizationId: orgId,
        roleId: { not: null },
        userRole: { slug: { not: 'viewer' } },
      },
    }),
    rawPrisma.building.count({ where: { organizationId: orgId } }),
    rawPrisma.room.count({ where: { organizationId: orgId } }),
    rawPrisma.maintenanceAsset.count({ where: { organizationId: orgId } }),
    rawPrisma.pmSchedule.count({ where: { organizationId: orgId } }),
    rawPrisma.iTDevice.count({ where: { organizationId: orgId } }),
    rawPrisma.calendar.count({
      where: {
        organizationId: orgId,
        calendarType: { not: 'PERSONAL' },
      },
    }),
    rawPrisma.approvalChannelConfig.count({ where: { organizationId: orgId } }),
    rawPrisma.sport.count({ where: { organizationId: orgId } }),
    rawPrisma.athleticTeam.count({ where: { organizationId: orgId } }),
    rawPrisma.academicYear.count({ where: { organizationId: orgId } }),
  ])

  const dismissed = new Set(org?.onboardingDismissedItems ?? [])
  const widgetDismissed = org?.onboardingWidgetDismissedAt !== null && org?.onboardingWidgetDismissedAt !== undefined

  // Profile completeness: all four fields populated.
  const profileComplete = Boolean(
    org?.gradeRange &&
    org?.studentCount &&
    org?.physicalAddress &&
    org?.logoUrl
  )

  const rawItems: ChecklistItem[] = [
    // ── Essentials (non-dismissable) ────────────────────────────────────
    {
      id: 'school-profile',
      title: 'Complete your school profile',
      description: 'Grade range, student count, address, and logo.',
      required: true,
      category: 'workspace',
      href: '/settings?tab=school-info',
      completed: profileComplete,
      dismissed: false,
      dismissable: false,
    },
    {
      id: 'setup-campus',
      title: 'Set up your campus',
      description: 'Add at least one building and one room so tickets and events have a place to live.',
      required: true,
      category: 'workspace',
      href: '/settings?tab=campus',
      completed: buildingCount > 0 && roomCount > 0,
      dismissed: false,
      dismissable: false,
    },
    {
      id: 'invite-team',
      title: 'Invite your team',
      description: 'Bring your staff into the workspace. You can invite by email or bulk upload.',
      required: true,
      category: 'workspace',
      href: '/settings?tab=users',
      completed: userCount > 1,
      dismissed: false,
      dismissable: false,
    },
    {
      id: 'assign-roles',
      title: 'Assign roles to your team',
      description: 'Give members the right permissions so they see the modules they need.',
      required: true,
      category: 'workspace',
      href: '/settings?tab=users',
      // Must have at least one non-viewer role holder besides the super admin.
      completed: memberWithRoleCount > 1,
      dismissed: false,
      dismissable: false,
    },

    // ── Per-module tasks (dismissable, client filters by visited modules) ──
    {
      id: 'maintenance-first-asset',
      title: 'Add your first asset',
      description: 'Track HVAC units, vehicles, and equipment that need preventive maintenance.',
      required: false,
      category: 'module',
      module: 'maintenance',
      href: '/maintenance/assets',
      completed: assetCount > 0,
      dismissed: dismissed.has('maintenance-first-asset'),
      dismissable: true,
    },
    {
      id: 'maintenance-pm-schedule',
      title: 'Set up a preventive maintenance schedule',
      description: 'Automate recurring inspections like HVAC filter changes and fire extinguisher checks.',
      required: false,
      category: 'module',
      module: 'maintenance',
      href: '/maintenance/pm-calendar',
      completed: pmScheduleCount > 0,
      dismissed: dismissed.has('maintenance-pm-schedule'),
      dismissable: true,
    },
    {
      id: 'it-first-device',
      title: 'Add your first device',
      description: 'Start tracking Chromebooks, iPads, or staff laptops manually or via roster sync.',
      required: false,
      category: 'module',
      module: 'it',
      href: '/it/devices',
      completed: deviceCount > 0,
      dismissed: dismissed.has('it-first-device'),
      dismissable: true,
    },
    {
      id: 'events-first-calendar',
      title: 'Create your first calendar',
      description: 'Organize events by calendar — academic, staff, parent-facing, athletics.',
      required: false,
      category: 'module',
      module: 'events',
      href: '/calendar',
      completed: nonPersonalCalendarCount > 0,
      dismissed: dismissed.has('events-first-calendar'),
      dismissable: true,
    },
    {
      id: 'events-approval-workflow',
      title: 'Configure your event approval workflow',
      description: 'Decide which events need admin approval and who should review them.',
      required: false,
      category: 'module',
      module: 'events',
      href: '/settings?tab=approval-config',
      completed: approvalConfigCount > 0,
      dismissed: dismissed.has('events-approval-workflow'),
      dismissable: true,
    },
    {
      id: 'athletics-first-sport',
      title: 'Add your first sport and team',
      description: 'Create sports, teams, and rosters to start scheduling games and practices.',
      required: false,
      category: 'module',
      module: 'athletics',
      href: '/athletics',
      completed: sportCount > 0 && athleticTeamCount > 0,
      dismissed: dismissed.has('athletics-first-sport'),
      dismissable: true,
    },
    {
      // Lives in settings rather than a dedicated module, so it isn't
      // gated on module visits — always visible to admins.
      id: 'academic-calendar-year',
      title: 'Set up the school year',
      description: 'Define your academic year, terms, and breaks so they appear everywhere.',
      required: false,
      category: 'workspace',
      href: '/settings?tab=academic-calendar',
      completed: academicYearCount > 0,
      dismissed: dismissed.has('academic-calendar-year'),
      dismissable: true,
    },
  ]

  // Filter out dismissed items — they never appear in the response.
  const items = rawItems.filter((item) => !item.dismissed)

  const requiredItems = items.filter((i) => i.required)
  const requiredCompleted = requiredItems.filter((i) => i.completed).length

  return {
    items,
    essentialComplete: requiredCompleted === requiredItems.length,
    totalCount: items.length,
    completedCount: items.filter((i) => i.completed).length,
    requiredCount: requiredItems.length,
    requiredCompleted,
    widgetDismissed,
  }
}

// ─── User-level checklist (non-admin) ────────────────────────────────────────

/**
 * Derive the lightweight user-level checklist. Runs for every authenticated
 * user regardless of role.
 */
export async function getUserChecklist(userId: string): Promise<ChecklistResponse> {
  const user = await rawPrisma.user.findUnique({
    where: { id: userId },
    select: {
      firstName: true,
      lastName: true,
      avatar: true,
      phone: true,
      pauseAllNotifications: true,
      onboardingDismissedItems: true,
    },
  })

  if (!user) {
    return {
      items: [],
      essentialComplete: true,
      totalCount: 0,
      completedCount: 0,
      requiredCount: 0,
      requiredCompleted: 0,
      widgetDismissed: false,
    }
  }

  const dismissed = new Set(user.onboardingDismissedItems ?? [])
  const profileComplete = Boolean(user.firstName && user.lastName && user.avatar)

  const rawItems: ChecklistItem[] = [
    {
      id: 'user-profile',
      title: 'Complete your profile',
      description: 'Add your name and a profile photo so your teammates know who you are.',
      required: true,
      category: 'profile',
      href: '/settings',
      completed: profileComplete,
      dismissed: false,
      dismissable: false,
    },
    {
      id: 'user-contact',
      title: 'Add your phone number',
      description: 'Needed if your school uses SMS notifications for urgent updates.',
      required: false,
      category: 'profile',
      href: '/settings',
      completed: Boolean(user.phone),
      dismissed: dismissed.has('user-contact'),
      dismissable: true,
    },
    {
      id: 'user-notifications',
      title: 'Set your notification preferences',
      description: 'Choose which alerts arrive by email vs in-app.',
      required: false,
      category: 'profile',
      href: '/settings',
      // "Touched" heuristic — the default is all-on; pausing counts as configured.
      completed: user.pauseAllNotifications === true,
      dismissed: dismissed.has('user-notifications'),
      dismissable: true,
    },
  ]

  const items = rawItems.filter((item) => !item.dismissed)
  const requiredItems = items.filter((i) => i.required)
  const requiredCompleted = requiredItems.filter((i) => i.completed).length

  return {
    items,
    essentialComplete: requiredCompleted === requiredItems.length,
    totalCount: items.length,
    completedCount: items.filter((i) => i.completed).length,
    requiredCount: requiredItems.length,
    requiredCompleted,
    widgetDismissed: false,
  }
}

// ─── Mutations ───────────────────────────────────────────────────────────────

/** Record a dismissal at the org level. Essentials should be rejected at the API layer. */
export async function dismissOrgItem(orgId: string, itemId: string): Promise<void> {
  const org = await rawPrisma.organization.findUnique({
    where: { id: orgId },
    select: { onboardingDismissedItems: true },
  })
  if (!org) return
  if (org.onboardingDismissedItems.includes(itemId)) return
  await rawPrisma.organization.update({
    where: { id: orgId },
    data: {
      onboardingDismissedItems: { set: [...org.onboardingDismissedItems, itemId] },
    },
  })
}

/** Record a dismissal at the user level. */
export async function dismissUserItem(userId: string, itemId: string): Promise<void> {
  const user = await rawPrisma.user.findUnique({
    where: { id: userId },
    select: { onboardingDismissedItems: true },
  })
  if (!user) return
  if (user.onboardingDismissedItems.includes(itemId)) return
  await rawPrisma.user.update({
    where: { id: userId },
    data: {
      onboardingDismissedItems: { set: [...user.onboardingDismissedItems, itemId] },
    },
  })
}

/** Dismiss the whole dashboard widget (admins only, only after essentials are done). */
export async function dismissOrgWidget(orgId: string): Promise<void> {
  await rawPrisma.organization.update({
    where: { id: orgId },
    data: { onboardingWidgetDismissedAt: new Date() },
  })
}
