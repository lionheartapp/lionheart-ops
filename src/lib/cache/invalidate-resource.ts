import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queries'

/**
 * Resource identifiers map 1:1 to sections of queryKeys. When a mutation to a
 * resource succeeds, callers invoke `invalidateResource(client, 'schools')` and
 * all related TanStack caches refresh on the next paint.
 *
 * Server-side invalidation is handled separately inside the route POST/PUT/
 * DELETE handlers via invalidateOrgCache — do NOT import that here (server-
 * only import would break the client bundle).
 */
export type ResourceName =
  | 'schools'
  | 'districts'
  | 'sites'
  | 'campuses'
  | 'buildings'
  | 'spaces'
  | 'rooms'
  | 'campus-lookup'
  | 'academic-years'
  | 'academic-terms'
  | 'bell-schedules'
  | 'day-schedules'
  | 'special-days'
  | 'calendar-categories'
  | 'forms'
  | 'twilio-config'
  | 'members'
  | 'roles'
  | 'teams'
  | 'permissions'
  | 'modules'

const RESOURCE_KEYS: Record<ResourceName, QueryKey[]> = {
  schools: [queryKeys.schools.all, queryKeys.campusLookup.tree],
  districts: [queryKeys.districts.all, queryKeys.schools.all],
  sites: [queryKeys.sites.all],
  campuses: [queryKeys.campuses.all, queryKeys.campusLookup.tree],
  buildings: [queryKeys.buildings.all, queryKeys.campusLookup.tree],
  spaces: [queryKeys.spaces.all, queryKeys.campusLookup.tree],
  rooms: [queryKeys.rooms.all, queryKeys.campusLookup.tree],
  'campus-lookup': [queryKeys.campusLookup.tree],
  'academic-years': [queryKeys.academicYears.all, queryKeys.academicTerms.all],
  'academic-terms': [queryKeys.academicTerms.all],
  'bell-schedules': [queryKeys.bellSchedules.all, queryKeys.daySchedules.all],
  'day-schedules': [queryKeys.daySchedules.all],
  'special-days': [queryKeys.specialDays.all],
  'calendar-categories': [queryKeys.calendarCategories.all],
  forms: [queryKeys.forms.all],
  'twilio-config': [queryKeys.twilioConfig.all],
  members: [queryKeys.members.all],
  roles: [queryKeys.roles.all],
  teams: [queryKeys.teams.all],
  permissions: [queryKeys.permissions.all, queryKeys.settingsPermissions.all],
  modules: [queryKeys.modules.all],
}

/**
 * Invalidate all TanStack caches related to a resource.
 *
 * Typical usage inside a mutation onSuccess:
 *
 *   onSuccess: () => invalidateResource(queryClient, 'schools')
 *
 * For multiple resources, pass an array:
 *
 *   onSuccess: () => invalidateResource(queryClient, ['schools', 'districts'])
 */
export function invalidateResource(
  queryClient: QueryClient,
  resource: ResourceName | ResourceName[]
): void {
  const resources = Array.isArray(resource) ? resource : [resource]
  for (const name of resources) {
    const keys = RESOURCE_KEYS[name]
    if (!keys) continue
    for (const key of keys) {
      queryClient.invalidateQueries({ queryKey: key })
    }
  }
}
