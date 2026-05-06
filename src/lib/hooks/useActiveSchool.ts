'use client'

/**
 * useActiveSchool — Global "school viewpoint" hook.
 *
 * The Lionheart platform is multi-tenant at the organization level, but a
 * single org can contain multiple schools (campuses). This hook gives every
 * page a consistent answer to the question: "which school is the user
 * currently viewing?"
 *
 * Think of it as a viewpoint, not a filter:
 *   - "All Schools" (null) — org-wide view (roll-ups, dashboards, admin)
 *   - A specific schoolId — scoped view (shows that school's teams, games,
 *     rooms, tickets; cross-school records still appear, rendered from that
 *     school's perspective — e.g. athletics "vs" vs "@" flips)
 *
 * Today "schools" are represented by the Campus model. When we eventually
 * split schools out of campuses, this hook stays the API and only its
 * internals change.
 *
 * Contract:
 *   - Source of truth: localStorage key `active-school-id`
 *     (empty string / missing = All Schools)
 *   - Writes dispatch a synchronous `active-school-changed` window event so
 *     other live instances of the hook re-sync without a full reload.
 *   - Hides "All Schools" option for users whose role limits them to one
 *     school (school-scoped members / viewers).
 *   - Returns `isMultiSchool: false` when the org has 0 or 1 schools, so
 *     consumers can hide the selector UI.
 *
 * Module restriction:
 *   - Pass `{ restrictToModule: 'maintenance' }` to scope the returned
 *     `schools` list to only those with that tenant module enabled.
 *   - When the global selection points to a school that does NOT have the
 *     module enabled, the hook returns `activeSchoolId: null` (acts as
 *     "All enabled schools"). The user's underlying selection is preserved
 *     in localStorage so leaving the module page restores their pick.
 *   - This replaces the legacy `useCampusFilter` hook — there is now ONE
 *     source of truth for which school is active across every module.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryOptions } from '@/lib/queries'
import { useModules } from '@/lib/hooks/useModuleEnabled'

export const ACTIVE_SCHOOL_STORAGE_KEY = 'active-school-id'
export const ACTIVE_SCHOOL_EVENT = 'active-school-changed'

/**
 * Shape returned by `/api/settings/campus/campuses`. We only depend on these
 * three fields; other fields (color, slug, etc.) are preserved in the raw
 * list but not typed here.
 */
export interface ActiveSchoolOption {
  readonly id: string
  readonly name: string
  readonly isActive: boolean
}

export interface UseActiveSchoolOptions {
  /**
   * When set, returned `schools` is filtered to those with this tenant
   * module enabled. If the global selection is not in the filtered set,
   * `activeSchoolId` falls through to `null` for this consumer (the
   * underlying localStorage value is left untouched).
   */
  readonly restrictToModule?: string
}

export interface UseActiveSchoolReturn {
  /** All active schools the user can switch between (filtered by module if set). */
  schools: ReadonlyArray<ActiveSchoolOption>
  /** `null` means "All Schools" (org-wide view). */
  activeSchoolId: string | null
  /** The resolved school record for `activeSchoolId`, or `null` when viewing all. */
  activeSchool: ActiveSchoolOption | null
  /** `true` when the user can meaningfully pick a school (>= 2 schools after filtering). */
  isMultiSchool: boolean
  /**
   * `true` when the user's role allows switching between schools.
   *
   * Scoped members/viewers (role stamped with `user-campus-scope` at login)
   * are pinned to one school and cannot view data from others. The UI should
   * render a read-only indicator rather than an interactive selector.
   */
  canSwitchSchools: boolean
  /** Combined loading flag — false once we have a concrete list to work with. */
  isLoading: boolean
  /** Set the active school. `null` selects "All Schools". */
  setActiveSchoolId: (id: string | null) => void
  /** Shortcut for `setActiveSchoolId(null)`. */
  clearSelection: () => void
  /** A friendly label for the current selection ('All Schools' or the school name). */
  activeSchoolLabel: string
}

interface ActiveSchoolChangeDetail {
  readonly schoolId: string | null
}

/**
 * Read the current selection from localStorage. Returns `null` for empty /
 * missing. SSR-safe (returns `null` on server).
 */
function readFromStorage(): string | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(ACTIVE_SCHOOL_STORAGE_KEY)
  if (!raw) return null
  return raw
}

/**
 * Detect whether the current user is campus-scoped (role is member/viewer
 * AND a campus scope was stamped at login). These users never see the
 * "All Schools" option and auto-default to their scope.
 *
 * Uses the same localStorage stamps the rest of the app already sets at login.
 * Reads the new `user-campus-scope` key first, then falls back to the legacy
 * `user-school-scope` key for sessions started before the rename.
 */
interface RoleScope {
  readonly isScoped: boolean
  readonly campusScope: string | null
  readonly homeSchoolId: string | null
}

function readRoleScope(): RoleScope {
  if (typeof window === 'undefined') return { isScoped: false, campusScope: null, homeSchoolId: null }
  const role = (window.localStorage.getItem('user-role') || '').toLowerCase()
  const campusScope =
    window.localStorage.getItem('user-campus-scope') ||
    window.localStorage.getItem('user-school-scope')
  const homeSchoolId = window.localStorage.getItem('user-school-id') || null
  const isScoped = (role === 'member' || role === 'viewer') && Boolean(campusScope)
  return { isScoped, campusScope, homeSchoolId }
}

const ALL_SCHOOLS_LABEL = 'All Schools'

export function useActiveSchool(options: UseActiveSchoolOptions = {}): UseActiveSchoolReturn {
  const { restrictToModule } = options
  const { data: rawSchools, isLoading: schoolsLoading } = useQuery(queryOptions.campuses())
  const { data: modulesData = [], isLoading: modulesLoading } = useModules()

  const allSchools = useMemo<ActiveSchoolOption[]>(() => {
    const list = (rawSchools ?? []) as ActiveSchoolOption[]
    return list.filter((s) => s.isActive)
  }, [rawSchools])

  // Build the set of school ids that have the requested module enabled. The
  // module record may store this on either `schoolId` (current schema) or
  // `campusId` (legacy field name) — accept both so we keep working through
  // the rename.
  const moduleEnabledIds = useMemo<Set<string> | null>(() => {
    if (!restrictToModule) return null
    const modules = (modulesData ?? []) as ReadonlyArray<{
      moduleId: string
      schoolId?: string | null
      campusId?: string | null
    }>
    const ids = new Set<string>()
    for (const m of modules) {
      if (m.moduleId !== restrictToModule) continue
      const id = m.schoolId ?? m.campusId
      if (id) ids.add(id)
    }
    return ids
  }, [modulesData, restrictToModule])

  const schools = useMemo<ActiveSchoolOption[]>(() => {
    if (!moduleEnabledIds) return allSchools
    return allSchools.filter((s) => moduleEnabledIds.has(s.id))
  }, [allSchools, moduleEnabledIds])

  const isMultiSchool = schools.length > 1

  // Hydrate from localStorage on mount, then stay in sync with other instances
  // via the custom event.
  const [storedSchoolId, setStoredSchoolIdState] = useState<string | null>(() => readFromStorage())

  // Track role-scope so the UI can render read-only when the user is pinned.
  // Re-read on `storage` events so logout/login flows stay current.
  const [roleScope, setRoleScope] = useState<RoleScope>(() => readRoleScope())

  useEffect(() => {
    const handleChange = (event: Event) => {
      const detail = (event as CustomEvent<ActiveSchoolChangeDetail>).detail
      setStoredSchoolIdState(detail?.schoolId ?? null)
    }
    const handleStorage = (event: StorageEvent) => {
      if (event.key === ACTIVE_SCHOOL_STORAGE_KEY) {
        setStoredSchoolIdState(event.newValue || null)
        return
      }
      if (
        event.key === 'user-role' ||
        event.key === 'user-campus-scope' ||
        event.key === 'user-school-scope' ||
        event.key === 'user-school-id'
      ) {
        setRoleScope(readRoleScope())
      }
    }
    window.addEventListener(ACTIVE_SCHOOL_EVENT, handleChange)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener(ACTIVE_SCHOOL_EVENT, handleChange)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  // Apply role-based default once schools are loaded. Scoped users get pinned
  // to their school and can't leave it; org-wide users default to "All
  // Schools" (null).
  useEffect(() => {
    if (schoolsLoading) return
    if (allSchools.length === 0) return
    if (!roleScope.isScoped || !roleScope.campusScope) return

    const match = allSchools.find(
      (s) => s.id === roleScope.campusScope || s.name === roleScope.campusScope,
    )
    if (!match) return

    // Scoped users are pinned — if anything (stale localStorage, a rogue
    // setActiveSchoolId call, etc.) points them elsewhere, snap back to their
    // scope. This is the enforcement companion to the read-only selector.
    if (storedSchoolId === match.id) return
    window.localStorage.setItem(ACTIVE_SCHOOL_STORAGE_KEY, match.id)
    setStoredSchoolIdState(match.id)
  }, [allSchools, schoolsLoading, storedSchoolId, roleScope])

  // Auto-default to user's home school on first load. Every user with a
  // schoolId starts in their own school — admins can switch away, members
  // stay pinned (handled by the scoped enforcement above). Only fires when
  // there's no existing selection in localStorage. District users (no schoolId)
  // stay on "All Schools".
  useEffect(() => {
    if (schoolsLoading) return
    if (allSchools.length === 0) return
    if (storedSchoolId) return // user already has a selection
    if (!roleScope.homeSchoolId) return // district user → stay on "All Schools"

    const match = allSchools.find((s) => s.id === roleScope.homeSchoolId)
    if (!match) return

    window.localStorage.setItem(ACTIVE_SCHOOL_STORAGE_KEY, match.id)
    setStoredSchoolIdState(match.id)
    window.dispatchEvent(
      new CustomEvent<ActiveSchoolChangeDetail>(ACTIVE_SCHOOL_EVENT, {
        detail: { schoolId: match.id },
      }),
    )
  }, [allSchools, schoolsLoading, storedSchoolId, roleScope.homeSchoolId])

  // If the currently-selected school disappears (deactivated, deleted), fall
  // back to "All Schools" to avoid a stale pointer.
  useEffect(() => {
    if (schoolsLoading) return
    if (!storedSchoolId) return
    if (allSchools.some((s) => s.id === storedSchoolId)) return
    window.localStorage.removeItem(ACTIVE_SCHOOL_STORAGE_KEY)
    setStoredSchoolIdState(null)
    window.dispatchEvent(
      new CustomEvent<ActiveSchoolChangeDetail>(ACTIVE_SCHOOL_EVENT, {
        detail: { schoolId: null },
      }),
    )
  }, [allSchools, schoolsLoading, storedSchoolId])

  const setActiveSchoolId = useCallback((id: string | null) => {
    if (typeof window === 'undefined') return
    if (id) {
      window.localStorage.setItem(ACTIVE_SCHOOL_STORAGE_KEY, id)
    } else {
      window.localStorage.removeItem(ACTIVE_SCHOOL_STORAGE_KEY)
    }
    setStoredSchoolIdState(id)
    window.dispatchEvent(
      new CustomEvent<ActiveSchoolChangeDetail>(ACTIVE_SCHOOL_EVENT, {
        detail: { schoolId: id },
      }),
    )
  }, [])

  const clearSelection = useCallback(() => {
    setActiveSchoolId(null)
  }, [setActiveSchoolId])

  // Effective selection: when restricted to a module, fall through to null
  // if the stored selection isn't enabled for that module. Don't mutate the
  // underlying storage — the user's pick should survive cross-module
  // navigation.
  const activeSchoolId = useMemo<string | null>(() => {
    if (!storedSchoolId) return null
    if (!moduleEnabledIds) return storedSchoolId
    return moduleEnabledIds.has(storedSchoolId) ? storedSchoolId : null
  }, [storedSchoolId, moduleEnabledIds])

  const activeSchool = useMemo<ActiveSchoolOption | null>(() => {
    if (!activeSchoolId) return null
    return schools.find((s) => s.id === activeSchoolId) ?? null
  }, [activeSchoolId, schools])

  const activeSchoolLabel = activeSchool?.name ?? ALL_SCHOOLS_LABEL
  const canSwitchSchools = !roleScope.isScoped
  const isLoading = schoolsLoading || (Boolean(restrictToModule) && modulesLoading)

  return {
    schools,
    activeSchoolId,
    activeSchool,
    isMultiSchool,
    canSwitchSchools,
    isLoading,
    setActiveSchoolId,
    clearSelection,
    activeSchoolLabel,
  }
}
