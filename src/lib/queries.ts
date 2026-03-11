/**
 * Centralized query keys & option factories.
 *
 * Every query in the app should use these factories so that:
 *  1. Keys stay consistent between pages and the prefetcher.
 *  2. Prefetch and runtime queries share the same queryFn + staleTime.
 *  3. Keys are easy to invalidate by prefix (e.g. queryKeys.tickets.all).
 *
 * Pattern inspired by TkDodo's "Effective React Query Keys":
 * https://tkdodo.eu/blog/effective-react-query-keys
 */

import { fetchApi } from '@/lib/api-client'

// ─── Query Keys ────────────────────────────────────────────────────────
export const queryKeys = {
  // Dashboard
  tickets: {
    all: ['tickets'] as const,
    list: (limit?: number) => ['tickets', { limit }] as const,
  },

  // Calendar
  calendars: {
    all: ['calendars'] as const,
  },
  calendarEvents: {
    all: ['calendar-events'] as const,
    range: (calendarIds: string[], start: string, end: string) =>
      ['calendar-events', calendarIds.join(','), start, end] as const,
  },

  // Settings / Org
  permissions: {
    all: ['permissions'] as const,
  },
  schoolInfo: {
    all: ['school-info'] as const,
  },
  orgLogo: {
    all: ['org-logo'] as const,
  },
  roles: {
    all: ['roles'] as const,
  },
  teams: {
    all: ['teams'] as const,
  },
  members: {
    all: ['members'] as const,
  },
  settingsPermissions: {
    all: ['settings-permissions'] as const,
  },
  campuses: {
    all: ['campuses'] as const,
  },
  modules: {
    all: ['tenant-modules'] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: (cursor?: string) => ['notifications', { cursor }] as const,
    unreadCount: ['notifications', 'unread-count'] as const,
  },

  // Athletics Calendar
  athleticsCalendar: {
    all: ['athletics-calendar-events'] as const,
    range: (campusIds: string[], start: string, end: string) =>
      ['athletics-calendar-events', campusIds.join(','), start, end] as const,
  },
  athleticsSports: {
    all: ['athletics-sports'] as const,
  },
  athleticsDashboard: {
    all: ['athletics-dashboard'] as const,
    campus: (campusId?: string | null) => ['athletics-dashboard', campusId ?? 'all'] as const,
  },
  athleticsTeams: {
    all: ['athletics-teams'] as const,
    filtered: (sportId?: string, seasonId?: string) =>
      ['athletics-teams', { sportId: sportId ?? '', seasonId: seasonId ?? '' }] as const,
  },
  athleticsSeasons: {
    all: ['athletics-seasons'] as const,
    bySport: (sportId?: string) =>
      ['athletics-seasons', { sportId: sportId ?? '' }] as const,
  },
  athleticsTournaments: {
    all: ['athletics-tournaments'] as const,
  },
  athleticsGames: {
    all: ['athletics-games'] as const,
    byTeam: (teamId?: string) =>
      ['athletics-games', { teamId: teamId ?? '' }] as const,
  },
  athleticsPractices: {
    all: ['athletics-practices'] as const,
    byTeam: (teamId?: string) =>
      ['athletics-practices', { teamId: teamId ?? '' }] as const,
  },
  athleticsRoster: {
    all: ['athletics-roster'] as const,
    byTeam: (teamId?: string) =>
      ['athletics-roster', { teamId: teamId ?? '' }] as const,
  },

  // IT Help Desk
  itTickets: {
    all: ['it-tickets'] as const,
    filtered: (filters?: Record<string, string>) =>
      ['it-tickets', filters ?? {}] as const,
  },
  itBoard: {
    all: ['it-board'] as const,
    filtered: (schoolId?: string) =>
      ['it-board', { schoolId: schoolId ?? '' }] as const,
  },
  itDashboard: {
    all: ['it-dashboard'] as const,
    filtered: (schoolId?: string) =>
      ['it-dashboard', { schoolId: schoolId ?? '' }] as const,
  },
  itTicketDetail: {
    byId: (id: string) => ['it-ticket', id] as const,
  },
  itTicketComments: {
    byTicket: (id: string) => ['it-ticket-comments', id] as const,
  },
  itMagicLinks: {
    all: ['it-magic-links'] as const,
  },
  // MDM + Roster
  itDevices: {
    all: ['it-devices'] as const,
    filtered: (filters?: Record<string, string>) =>
      ['it-devices', filters ?? {}] as const,
  },
  itDeviceDetail: {
    byId: (id: string) => ['it-device', id] as const,
  },
  itStudents: {
    all: ['it-students'] as const,
    filtered: (filters?: Record<string, string>) =>
      ['it-students', filters ?? {}] as const,
  },
  itStudentDetail: {
    byId: (id: string) => ['it-student', id] as const,
  },
  itLoaners: {
    all: ['it-loaners'] as const,
  },
  itLoanerOverdue: {
    all: ['it-loaner-overdue'] as const,
  },
  itLemons: {
    all: ['it-lemons'] as const,
  },
  itConfig: {
    all: ['it-config'] as const,
  },
  itSyncConfigs: {
    all: ['it-sync-configs'] as const,
  },
  itSyncJobs: {
    all: ['it-sync-jobs'] as const,
    filtered: (filters?: Record<string, string>) =>
      ['it-sync-jobs', filters ?? {}] as const,
  },
  // Device Lifecycle
  itDeploymentBatches: {
    all: ['it-deployment-batches'] as const,
    filtered: (filters?: Record<string, string>) =>
      ['it-deployment-batches', filters ?? {}] as const,
  },
  itDeploymentBatchDetail: {
    one: (id: string) => ['it-deployment-batch', id] as const,
  },
  itDeploymentBatchProgress: {
    one: (id: string) => ['it-deployment-batch-progress', id] as const,
  },
  itDamageSummary: {
    one: (batchId: string) => ['it-damage-summary', batchId] as const,
  },
  itDefaultFees: {
    all: ['it-default-fees'] as const,
  },
  itSummerMode: {
    all: ['it-summer-mode'] as const,
  },
  itSummerBatches: {
    all: ['it-summer-batches'] as const,
    filtered: (filters?: Record<string, string>) =>
      ['it-summer-batches', filters ?? {}] as const,
  },
  itSummerBatchDetail: {
    one: (id: string) => ['it-summer-batch', id] as const,
  },
  itStagingCounts: {
    all: ['it-staging-counts'] as const,
  },
  itRepairQueue: {
    all: ['it-repair-queue'] as const,
    filtered: (filters?: Record<string, string>) =>
      ['it-repair-queue', filters ?? {}] as const,
  },
  itMdmConfig: {
    all: ['it-mdm-config'] as const,
  },
  // Account Provisioning
  itProvisioningConfig: {
    all: ['it-provisioning-config'] as const,
  },
  itProvisioningEvents: {
    all: ['it-provisioning-events'] as const,
    filtered: (filters?: Record<string, string>) =>
      ['it-provisioning-events', filters ?? {}] as const,
  },
  itOrphanedAccounts: {
    all: ['it-orphaned-accounts'] as const,
  },
  // IT Analytics & Reports
  itAnalytics: {
    all: ['it-analytics'] as const,
    filtered: (schoolId?: string, months?: number) =>
      ['it-analytics', { schoolId: schoolId ?? '', months: months ?? 6 }] as const,
  },
  itAnalyticsDistrict: {
    all: ['it-analytics-district'] as const,
  },
  itReports: {
    annual: (from: string, to: string, schoolId?: string) =>
      ['it-report-annual', { from, to, schoolId: schoolId ?? '' }] as const,
    refreshForecast: (years?: number) =>
      ['it-report-refresh-forecast', { years: years ?? 4 }] as const,
    repairReplace: ['it-report-repair-replace'] as const,
    damageFees: (schoolId?: string) =>
      ['it-report-damage-fees', { schoolId: schoolId ?? '' }] as const,
    ticketRoi: ['it-report-ticket-roi'] as const,
  },
  itERateCalendar: {
    all: ['it-erate-calendar'] as const,
    byYear: (schoolYear?: string) =>
      ['it-erate-calendar', { schoolYear: schoolYear ?? '' }] as const,
  },
  itERateDocuments: {
    all: ['it-erate-documents'] as const,
    filtered: (schoolYear?: string, taskId?: string) =>
      ['it-erate-documents', { schoolYear: schoolYear ?? '', taskId: taskId ?? '' }] as const,
  },
  itFilterConfigs: {
    all: ['it-filter-configs'] as const,
  },
  itFilterEvents: {
    all: ['it-filter-events'] as const,
    filtered: (filters?: Record<string, string>) =>
      ['it-filter-events', filters ?? {}] as const,
  },
  // Security Incidents
  securityIncidents: {
    all: ['security-incidents'] as const,
    filtered: (filters?: Record<string, string>) =>
      ['security-incidents', filters ?? {}] as const,
  },
  securityIncidentDetail: {
    byId: (id: string) => ['security-incident', id] as const,
  },
} as const

// ─── Query Option Factories ────────────────────────────────────────────
// Each factory returns the full options object (queryKey + queryFn + staleTime)
// usable by both useQuery() and queryClient.prefetchQuery().

export const queryOptions = {
  tickets: (limit = 10) => ({
    queryKey: queryKeys.tickets.list(limit),
    queryFn: () =>
      fetchApi<{ tickets: unknown[] } | unknown[]>(`/api/tickets?limit=${limit}`),
    staleTime: 5 * 60 * 1000, // 5 minutes — ticket data doesn't change every second
  }),

  calendars: () => ({
    queryKey: queryKeys.calendars.all,
    queryFn: () => fetchApi<unknown[]>('/api/calendars'),
    staleTime: 60 * 1000, // 1 minute
  }),

  permissions: () => ({
    queryKey: queryKeys.permissions.all,
    queryFn: () =>
      fetchApi<{
        canManageWorkspace: boolean
        canWriteAthletics: boolean
        canManageUsers: boolean
        canManageMaintenance: boolean
        canClaimMaintenance: boolean
        canSubmitMaintenance: boolean
        canApproveQA: boolean
        canManageIT: boolean
        canSubmitIT: boolean
        canManageDevices: boolean
        canReadDevices: boolean
        canManageStudents: boolean
        canReadStudents: boolean
        canManageLoaners: boolean
        canCheckoutLoaner: boolean
        canCheckinLoaner: boolean
        canManageSync: boolean
        canViewIntelligence: boolean
        canConfigureDevices: boolean
        canReadInventory: boolean
        canWriteInventory: boolean
        legacyRole: string | null
      }>('/api/auth/permissions'),
    staleTime: 10 * 60 * 1000, // 10 minutes — permissions rarely change mid-session
  }),

  schoolInfo: () => ({
    queryKey: queryKeys.schoolInfo.all,
    queryFn: () => fetchApi<Record<string, unknown>>('/api/onboarding/school-info'),
    staleTime: 10 * 60 * 1000,
  }),

  roles: () => ({
    queryKey: queryKeys.roles.all,
    queryFn: () => fetchApi<unknown[]>('/api/settings/roles'),
    staleTime: 5 * 60 * 1000,
  }),

  teams: () => ({
    queryKey: queryKeys.teams.all,
    queryFn: () => fetchApi<unknown[]>('/api/settings/teams'),
    staleTime: 5 * 60 * 1000,
  }),

  members: () => ({
    queryKey: queryKeys.members.all,
    queryFn: () => fetchApi<unknown[]>('/api/settings/users'),
    staleTime: 5 * 60 * 1000,
  }),

  settingsPermissions: () => ({
    queryKey: queryKeys.settingsPermissions.all,
    queryFn: () => fetchApi<unknown[]>('/api/settings/permissions'),
    staleTime: 10 * 60 * 1000,
  }),

  campuses: () => ({
    queryKey: queryKeys.campuses.all,
    queryFn: () => fetchApi<unknown[]>('/api/settings/campus/campuses'),
    staleTime: 5 * 60 * 1000,
  }),

  modules: () => ({
    queryKey: queryKeys.modules.all,
    queryFn: () => fetchApi<unknown[]>('/api/modules'),
    staleTime: 5 * 60 * 1000,
  }),

  calendarEvents: (calendarIds: string[], start: string, end: string) => ({
    queryKey: queryKeys.calendarEvents.range(calendarIds, start, end),
    queryFn: () => {
      const params = new URLSearchParams({ calendarIds: calendarIds.join(','), start, end })
      return fetchApi<unknown[]>(`/api/calendar-events?${params}`)
    },
    staleTime: 5 * 60_000,
  }),

  athleticsCalendarEvents: (campusIds: string[], start: string, end: string) => ({
    queryKey: queryKeys.athleticsCalendar.range(campusIds, start, end),
    queryFn: () => {
      const params = new URLSearchParams({ campusIds: campusIds.join(','), start, end })
      return fetchApi<unknown[]>(`/api/athletics/calendar-events?${params}`)
    },
    staleTime: 5 * 60_000,
  }),

  athleticsSports: () => ({
    queryKey: queryKeys.athleticsSports.all,
    queryFn: () => fetchApi<unknown[]>('/api/athletics/sports'),
    staleTime: 10 * 60_000,
  }),

  athleticsDashboard: (campusId?: string | null) => ({
    queryKey: queryKeys.athleticsDashboard.campus(campusId),
    queryFn: () => {
      const params = campusId ? `?campusId=${campusId}` : ''
      return fetchApi<unknown>(`/api/athletics/dashboard${params}`)
    },
    staleTime: 2 * 60_000,
  }),

  athleticsTeams: (sportId?: string, seasonId?: string) => ({
    queryKey: queryKeys.athleticsTeams.filtered(sportId, seasonId),
    queryFn: () => {
      const params = new URLSearchParams()
      if (sportId) params.set('sportId', sportId)
      if (seasonId) params.set('seasonId', seasonId)
      const qs = params.toString()
      return fetchApi<unknown[]>(`/api/athletics/teams${qs ? `?${qs}` : ''}`)
    },
    staleTime: 5 * 60_000,
  }),

  athleticsSeasons: (sportId?: string) => ({
    queryKey: queryKeys.athleticsSeasons.bySport(sportId),
    queryFn: () => {
      const param = sportId ? `?sportId=${sportId}` : ''
      return fetchApi<unknown[]>(`/api/athletics/seasons${param}`)
    },
    staleTime: 5 * 60_000,
  }),

  athleticsTournaments: () => ({
    queryKey: queryKeys.athleticsTournaments.all,
    queryFn: () => fetchApi<unknown[]>('/api/athletics/tournaments'),
    staleTime: 5 * 60_000,
  }),

  athleticsGames: (teamId?: string) => ({
    queryKey: queryKeys.athleticsGames.byTeam(teamId),
    queryFn: () => {
      const param = teamId ? `?teamId=${teamId}` : ''
      return fetchApi<unknown[]>(`/api/athletics/games${param}`)
    },
    staleTime: 5 * 60_000,
  }),

  athleticsPractices: (teamId?: string) => ({
    queryKey: queryKeys.athleticsPractices.byTeam(teamId),
    queryFn: () => {
      const param = teamId ? `?teamId=${teamId}` : ''
      return fetchApi<unknown[]>(`/api/athletics/practices${param}`)
    },
    staleTime: 5 * 60_000,
  }),

  athleticsRoster: (teamId?: string) => ({
    queryKey: queryKeys.athleticsRoster.byTeam(teamId),
    queryFn: () => {
      const param = teamId ? `?teamId=${teamId}` : ''
      return fetchApi<unknown[]>(`/api/athletics/roster${param}`)
    },
    staleTime: 5 * 60_000,
  }),

  // IT Help Desk
  itTickets: (filters?: Record<string, string>) => ({
    queryKey: queryKeys.itTickets.filtered(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters) {
        Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v) })
      }
      const qs = params.toString()
      return fetchApi<{ tickets: unknown[]; total: number }>(`/api/it/tickets${qs ? `?${qs}` : ''}`)
    },
    staleTime: 30_000,
  }),

  itBoard: (schoolId?: string) => ({
    queryKey: queryKeys.itBoard.filtered(schoolId),
    queryFn: () => {
      const param = schoolId ? `?schoolId=${schoolId}` : ''
      return fetchApi<Record<string, unknown[]>>(`/api/it/board${param}`)
    },
    staleTime: 30_000,
  }),

  itDashboard: (schoolId?: string) => ({
    queryKey: queryKeys.itDashboard.filtered(schoolId),
    queryFn: () => {
      const param = schoolId ? `?schoolId=${schoolId}` : ''
      return fetchApi<{
        total: number
        open: number
        inProgress: number
        onHold: number
        urgent: number
        recentDone: number
        unassignedCount: number
        avgResolutionHours: number | null
        byStatus: Record<string, number>
        byIssueType: Record<string, number>
        byPriority: Record<string, number>
        bySource: Record<string, number>
        onHoldByReason: Record<string, number>
        recentActivity: Array<{
          id: string
          ticketId: string
          type: string
          content: string | null
          createdAt: string
          ticketNumber: string
          ticketTitle: string
          actorName: string | null
        }>
      }>(`/api/it/dashboard${param}`)
    },
    staleTime: 60_000,
  }),

  itTicketDetail: (id: string) => ({
    queryKey: queryKeys.itTicketDetail.byId(id),
    queryFn: () => fetchApi<unknown>(`/api/it/tickets/${id}`),
    staleTime: 30_000,
  }),

  itTicketComments: (ticketId: string) => ({
    queryKey: queryKeys.itTicketComments.byTicket(ticketId),
    queryFn: () => fetchApi<unknown[]>(`/api/it/tickets/${ticketId}/comments`),
    staleTime: 15_000,
  }),

  // MDM + Roster
  itDevices: (filters?: Record<string, string>) => ({
    queryKey: queryKeys.itDevices.filtered(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters) Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v) })
      const qs = params.toString()
      return fetchApi<unknown[]>(`/api/it/devices${qs ? `?${qs}` : ''}`)
    },
    staleTime: 30_000,
  }),

  itDeviceDetail: (id: string) => ({
    queryKey: queryKeys.itDeviceDetail.byId(id),
    queryFn: () => fetchApi<unknown>(`/api/it/devices/${id}`),
    staleTime: 30_000,
  }),

  itStudents: (filters?: Record<string, string>) => ({
    queryKey: queryKeys.itStudents.filtered(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters) Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v) })
      const qs = params.toString()
      return fetchApi<{ students: unknown[]; total: number }>(`/api/it/students${qs ? `?${qs}` : ''}`)
    },
    staleTime: 30_000,
  }),

  itStudentDetail: (id: string) => ({
    queryKey: queryKeys.itStudentDetail.byId(id),
    queryFn: () => fetchApi<unknown>(`/api/it/students/${id}`),
    staleTime: 30_000,
  }),

  itLoaners: () => ({
    queryKey: queryKeys.itLoaners.all,
    queryFn: () => fetchApi<unknown>('/api/it/loaners'),
    staleTime: 30_000,
  }),

  itLemons: () => ({
    queryKey: queryKeys.itLemons.all,
    queryFn: () => fetchApi<unknown[]>('/api/it/intelligence/lemons'),
    staleTime: 60_000,
  }),

  itConfig: () => ({
    queryKey: queryKeys.itConfig.all,
    queryFn: () => fetchApi<unknown>('/api/it/config'),
    staleTime: 5 * 60_000,
  }),

  itSyncConfigs: () => ({
    queryKey: queryKeys.itSyncConfigs.all,
    queryFn: () => fetchApi<unknown[]>('/api/it/sync/configs'),
    staleTime: 60_000,
  }),

  itSyncJobs: (filters?: Record<string, string>) => ({
    queryKey: queryKeys.itSyncJobs.filtered(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters) Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v) })
      const qs = params.toString()
      return fetchApi<unknown[]>(`/api/it/sync/jobs${qs ? `?${qs}` : ''}`)
    },
    staleTime: 30_000,
  }),

  // Device Lifecycle
  itDeploymentBatches: (filters?: Record<string, string>) => ({
    queryKey: queryKeys.itDeploymentBatches.filtered(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters) Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v) })
      const qs = params.toString()
      return fetchApi<unknown[]>(`/api/it/deployment/batches${qs ? `?${qs}` : ''}`)
    },
    staleTime: 30_000,
  }),

  itDeploymentBatchDetail: (id: string) => ({
    queryKey: queryKeys.itDeploymentBatchDetail.one(id),
    queryFn: () => fetchApi<unknown>(`/api/it/deployment/batches/${id}`),
    staleTime: 15_000,
  }),

  itDeploymentBatchProgress: (id: string) => ({
    queryKey: queryKeys.itDeploymentBatchProgress.one(id),
    queryFn: () => fetchApi<{ total: number; processed: number; remaining: number }>(`/api/it/deployment/batches/${id}/progress`),
    staleTime: 10_000,
  }),

  itDamageSummary: (batchId: string) => ({
    queryKey: queryKeys.itDamageSummary.one(batchId),
    queryFn: () => fetchApi<unknown>(`/api/it/damage/summary/${batchId}`),
    staleTime: 30_000,
  }),

  itDefaultFees: () => ({
    queryKey: queryKeys.itDefaultFees.all,
    queryFn: () => fetchApi<Record<string, number>>('/api/it/damage/default-fees'),
    staleTime: 60_000,
  }),

  itSummerMode: () => ({
    queryKey: queryKeys.itSummerMode.all,
    queryFn: () => fetchApi<{ active: boolean; startDate: string | null; endDate: string | null }>('/api/it/summer/mode'),
    staleTime: 30_000,
  }),

  itSummerBatches: (filters?: Record<string, string>) => ({
    queryKey: queryKeys.itSummerBatches.filtered(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters) Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v) })
      const qs = params.toString()
      return fetchApi<unknown[]>(`/api/it/summer/batches${qs ? `?${qs}` : ''}`)
    },
    staleTime: 30_000,
  }),

  itSummerBatchDetail: (id: string) => ({
    queryKey: queryKeys.itSummerBatchDetail.one(id),
    queryFn: () => fetchApi<unknown>(`/api/it/summer/batches/${id}`),
    staleTime: 15_000,
  }),

  itStagingCounts: () => ({
    queryKey: queryKeys.itStagingCounts.all,
    queryFn: () => fetchApi<{ total: number; byModel: Record<string, number> }>('/api/it/summer/staging'),
    staleTime: 30_000,
  }),

  itRepairQueue: (filters?: Record<string, string>) => ({
    queryKey: queryKeys.itRepairQueue.filtered(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters) Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v) })
      const qs = params.toString()
      return fetchApi<unknown[]>(`/api/it/summer/repair-queue${qs ? `?${qs}` : ''}`)
    },
    staleTime: 30_000,
  }),

  itMdmConfig: () => ({
    queryKey: queryKeys.itMdmConfig.all,
    queryFn: () => fetchApi<unknown>('/api/it/mdm/config'),
    staleTime: 60_000,
  }),

  // Account Provisioning
  itProvisioningConfig: () => ({
    queryKey: queryKeys.itProvisioningConfig.all,
    queryFn: () => fetchApi<unknown>('/api/it/provisioning/config'),
    staleTime: 60_000,
  }),

  itProvisioningEvents: (filters?: Record<string, string>) => ({
    queryKey: queryKeys.itProvisioningEvents.filtered(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters) Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v) })
      const qs = params.toString()
      return fetchApi<{ events: unknown[]; total: number }>(`/api/it/provisioning/events${qs ? `?${qs}` : ''}`)
    },
    staleTime: 30_000,
  }),

  itOrphanedAccounts: () => ({
    queryKey: queryKeys.itOrphanedAccounts.all,
    queryFn: () => fetchApi<unknown[]>('/api/it/provisioning/orphaned?resolved=false'),
    staleTime: 60_000,
  }),

  // IT Analytics & Reports
  itAnalytics: (schoolId?: string, months?: number) => ({
    queryKey: queryKeys.itAnalytics.filtered(schoolId, months),
    queryFn: () => {
      const params = new URLSearchParams()
      if (schoolId) params.set('schoolId', schoolId)
      if (months) params.set('months', String(months))
      const qs = params.toString()
      return fetchApi<unknown>(`/api/it/analytics${qs ? `?${qs}` : ''}`)
    },
    staleTime: 2 * 60_000,
  }),

  itAnalyticsDistrict: () => ({
    queryKey: queryKeys.itAnalyticsDistrict.all,
    queryFn: () => fetchApi<unknown>('/api/it/analytics/district'),
    staleTime: 2 * 60_000,
  }),

  itReportAnnual: (from: string, to: string, schoolId?: string) => ({
    queryKey: queryKeys.itReports.annual(from, to, schoolId),
    queryFn: () => {
      const params = new URLSearchParams({ from, to })
      if (schoolId) params.set('schoolId', schoolId)
      return fetchApi<unknown>(`/api/it/reports/annual?${params}`)
    },
    staleTime: 5 * 60_000,
  }),

  itReportRefreshForecast: (years?: number) => ({
    queryKey: queryKeys.itReports.refreshForecast(years),
    queryFn: () => {
      const param = years ? `?thresholdYears=${years}` : ''
      return fetchApi<unknown>(`/api/it/reports/refresh-forecast${param}`)
    },
    staleTime: 5 * 60_000,
  }),

  itReportRepairReplace: () => ({
    queryKey: queryKeys.itReports.repairReplace,
    queryFn: () => fetchApi<unknown>('/api/it/reports/repair-replace'),
    staleTime: 5 * 60_000,
  }),

  itReportDamageFees: (schoolId?: string) => ({
    queryKey: queryKeys.itReports.damageFees(schoolId),
    queryFn: () => {
      const param = schoolId ? `?schoolId=${schoolId}` : ''
      return fetchApi<unknown>(`/api/it/reports/damage-fees${param}`)
    },
    staleTime: 5 * 60_000,
  }),

  itERateCalendar: (schoolYear?: string) => ({
    queryKey: queryKeys.itERateCalendar.byYear(schoolYear),
    queryFn: () => {
      const param = schoolYear ? `?schoolYear=${schoolYear}` : ''
      return fetchApi<unknown>(`/api/it/erate/calendar${param}`)
    },
    staleTime: 60_000,
  }),

  itERateDocuments: (schoolYear?: string, taskId?: string) => ({
    queryKey: queryKeys.itERateDocuments.filtered(schoolYear, taskId),
    queryFn: () => {
      const params = new URLSearchParams()
      if (schoolYear) params.set('schoolYear', schoolYear)
      if (taskId) params.set('taskId', taskId)
      const qs = params.toString()
      return fetchApi<unknown>(`/api/it/erate/documents${qs ? `?${qs}` : ''}`)
    },
    staleTime: 60_000,
  }),

  itFilterConfigs: () => ({
    queryKey: queryKeys.itFilterConfigs.all,
    queryFn: () => fetchApi<unknown>('/api/it/content-filters/config'),
    staleTime: 60_000,
  }),

  itFilterEvents: (filters?: Record<string, string>) => ({
    queryKey: queryKeys.itFilterEvents.filtered(filters),
    queryFn: () => {
      const params = new URLSearchParams(filters ?? {})
      const qs = params.toString()
      return fetchApi<unknown>(`/api/it/content-filters/events${qs ? `?${qs}` : ''}`)
    },
    staleTime: 30_000,
  }),

  // Security Incidents
  securityIncidents: (filters?: Record<string, string>) => ({
    queryKey: queryKeys.securityIncidents.filtered(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters) Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v) })
      const qs = params.toString()
      return fetchApi<{ incidents: unknown[]; total: number }>(`/api/it/incidents${qs ? `?${qs}` : ''}`)
    },
    staleTime: 30_000,
  }),

  securityIncidentDetail: (id: string) => ({
    queryKey: queryKeys.securityIncidentDetail.byId(id),
    queryFn: () => fetchApi<unknown>(`/api/it/incidents/${id}`),
    staleTime: 15_000,
  }),
} as const
