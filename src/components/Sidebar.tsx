'use client'

import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, Fragment, type RefCallback } from 'react'
import { motion, AnimatePresence, useMotionValue, animate as fmAnimate } from 'framer-motion'
import PrefetchLink from '@/components/PrefetchLink'
import ConfirmDialog from '@/components/ConfirmDialog'
// NotificationBell moved to dashboard page, next to Create button
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Home,
  Menu,
  X,
  User,
  School,
  Shield,
  Users,
  UserCog,
  Building2,
  Calendar,
  CalendarClock,
  Trophy,
  Puzzle,
  ChevronDown,
  ChevronRight,
  Plus,
  MoreHorizontal,
  Check,
  Pencil,
  Palette,
  Trash2,
  HelpCircle,
  Search,
  Wrench,
  Monitor,
  Package,
  ScrollText,
  CreditCard,
  Settings,
  LogOut,
  Eye,
  MoreVertical,
  Sparkles,
  Link2,
} from 'lucide-react'
import ReportBugDialog from '@/components/ReportBugDialog'
import ViewAsDialog from '@/components/ViewAsDialog'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryOptions } from '@/lib/queries'
import { useModuleEnabled, useModules } from '@/lib/hooks/useModuleEnabled'
import { usePermissions, isOnTeam } from '@/lib/hooks/usePermissions'
import { usePendingGateCount } from '@/lib/hooks/useEventProject'
import CampusShapeIndicator, { buildCampusShapeMap, getShapeIndex } from '@/components/calendar/CampusShapeIndicator'
import MeetWithSection from '@/components/calendar/MeetWithSection'
import type { MeetWithPerson } from '@/lib/hooks/useMeetWith'
import { MEET_WITH_COLORS } from '@/lib/hooks/useMeetWith'

const COLOR_PRESETS = [
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Slate', value: '#64748b' },
]

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

export type SettingsTab = 'profile' | 'school-info' | 'roles' | 'teams' | 'users' | 'campus' | 'add-ons' | 'integrations' | 'activity-log' | 'billing'
export type AthleticsTab = 'overview' | 'sports' | 'teams' | 'schedule' | 'roster' | 'tournaments' | 'stats'
export type MaintenanceTab = 'dashboard' | 'pm-calendar'

export interface EventProjectSummary {
  id: string
  title: string
  status: string
}

interface AthleticsCampus {
  id: string
  name: string
  color: string
}

// ── Module-level state for the facilities indicator ──
// These survive component remounts (which happen on every Next.js page
// navigation because DashboardLayout is inside page.tsx, not layout.tsx).
// Without module-level persistence, the indicator always "snaps" because
// the component has no memory of where it was before navigation.
let _facilityLastPos: { top: number; height: number } | null = null
let _facilityMeasured = false

// ── Module-level state for the IT indicator ──
let _itLastPos: { top: number; height: number } | null = null
let _itMeasured = false

export default function Sidebar({
  userName = 'User',
  userEmail = 'user@school.edu',
  userAvatar,
  organizationName,
  organizationLogoUrl,
  onLogout,
  onSearchOpen,
}: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const pageSearchParams = useSearchParams()
  const queryClient = useQueryClient()
  const athleticsPrefetched = useRef(false)
  const [isOpen, setIsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(() => pathname.startsWith('/settings'))
  const [bugDialogOpen, setBugDialogOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const [isViewAsOpen, setIsViewAsOpen] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [isImpersonating, setIsImpersonating] = useState(false)

  // Detect super-admin role and impersonation state
  useEffect(() => {
    const role = (localStorage.getItem('user-role') || '').toLowerCase().replace(/\s+/g, '-')
    setIsSuperAdmin(role === 'super-admin')
    setIsImpersonating(localStorage.getItem('is-impersonating') === 'true')
  }, [pathname])

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>('profile')

  // Events sidebar state
  const [eventsOpen, setEventsOpen] = useState(() =>
    pathname.startsWith('/events') || pathname.startsWith('/calendar') || pathname.startsWith('/planning')
  )

  // Athletics sidebar state
  const [athleticsOpen, setAthleticsOpen] = useState(() => pathname.startsWith('/athletics'))
  // Helper: is this path in the maintenance context? (includes /inventory?dept=maintenance)
  const isMaintenancePath = (p: string, params?: URLSearchParams) =>
    p.startsWith('/maintenance') || (p === '/inventory' && params?.get('dept') === 'maintenance')
  // Helper: is this path in the IT context? (includes /inventory?dept=it)
  const isITPath = (p: string, params?: URLSearchParams) =>
    p.startsWith('/it') || (p === '/inventory' && params?.get('dept') === 'it')

  const [facilitiesOpen, setFacilitiesOpen] = useState(() => isMaintenancePath(pathname, pageSearchParams))
  const [itOpen, setItOpen] = useState(() => isITPath(pathname, pageSearchParams))

  // ── Facilities nav indicator ──
  // Uses Framer Motion's useMotionValue + animate() for the indicator position.
  // This is immune to React re-render interference and works even when the
  // component remounts (because position memory is module-level).
  const facilitiesContainerRef = useRef<HTMLDivElement | null>(null)
  const facilityTrailRef = useRef<HTMLDivElement | null>(null)
  const [facilityContainerMounted, setFacilityContainerMounted] = useState(false)

  // Framer Motion values for the indicator — animated independently of React renders
  const indicatorTop = useMotionValue(0)
  const indicatorHeight = useMotionValue(0)
  const indicatorOpacity = useMotionValue(0)

  // Callback refs: skip display:none (mobile on desktop) via offsetParent check.
  // mainNavContent renders in BOTH desktop and mobile sidebars — we only want
  // refs from the VISIBLE instance.
  const facilityTrailRefCb = useCallback((node: HTMLDivElement | null) => {
    if (node && node.offsetParent === null) return
    facilityTrailRef.current = node
    if (node) node.style.opacity = '0'
  }, [])

  const facilitiesContainerRefCb: RefCallback<HTMLDivElement> = useCallback((node) => {
    if (node && node.offsetParent === null) return
    facilitiesContainerRef.current = node
    setFacilityContainerMounted(!!node)
  }, [])

  // ── IT nav indicator (mirrors facilities indicator pattern) ──
  const itContainerRef = useRef<HTMLDivElement | null>(null)
  const itTrailRef = useRef<HTMLDivElement | null>(null)
  const [itContainerMounted, setItContainerMounted] = useState(false)

  const itIndicatorTop = useMotionValue(0)
  const itIndicatorHeight = useMotionValue(0)
  const itIndicatorOpacity = useMotionValue(0)

  const itTrailRefCb = useCallback((node: HTMLDivElement | null) => {
    if (node && node.offsetParent === null) return
    itTrailRef.current = node
    if (node) node.style.opacity = '0'
  }, [])

  const itContainerRefCb: RefCallback<HTMLDivElement> = useCallback((node) => {
    if (node && node.offsetParent === null) return
    itContainerRef.current = node
    setItContainerMounted(!!node)
  }, [])
  const [athleticsCampusId, setAthleticsCampusId] = useState<string | null>(null)
  const [athleticsCampuses, setAthleticsCampuses] = useState<AthleticsCampus[]>([])

  // Directly fetch athletics campuses — eliminates race condition with CustomEvent
  const DEFAULT_CAMPUS_COLORS = ['#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ef4444', '#14b8a6']
  const { data: sidebarModules = [] } = useModules()
  const { data: sidebarCampusesRaw } = useQuery({
    ...queryOptions.campuses(),
    enabled: athleticsOpen,
  })

  useEffect(() => {
    if (!athleticsOpen) return
    const enabledIds = sidebarModules
      .filter((m) => m.moduleId === 'athletics' && m.campusId)
      .map((m) => m.campusId as string)
    const allCampuses = (sidebarCampusesRaw as { id: string; name: string; isActive: boolean }[] | undefined) ?? []
    const enabled = allCampuses.filter((c) => enabledIds.includes(c.id))
    if (enabled.length > 0) {
      setAthleticsCampuses((prev) => {
        // Only update if campus IDs actually changed
        const prevIds = prev.map((c) => c.id).join(',')
        const nextIds = enabled.map((c) => c.id).join(',')
        if (prevIds === nextIds) return prev
        return enabled.map((c, i) => ({
          id: c.id,
          name: c.name,
          color: DEFAULT_CAMPUS_COLORS[i % DEFAULT_CAMPUS_COLORS.length],
        }))
      })
      if (!athleticsCampusId) setAthleticsCampusId(enabled[0].id)
    }
  }, [athleticsOpen, sidebarModules, sidebarCampusesRaw]) // eslint-disable-line react-hooks/exhaustive-deps

  // Open settings panel when navigating to /settings
  const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect
  useIsomorphicLayoutEffect(() => {
    if (pathname.startsWith('/settings')) {
      setSettingsOpen(true)
      setAthleticsOpen(false)
      setEventsOpen(false)
    }
  }, [pathname])

  // Listen for settings tab change events from the settings page (both event types)
  useEffect(() => {
    const handleTabEvent = (e: Event) => {
      const event = e as CustomEvent<{ tab: SettingsTab }>
      if (event.detail?.tab) {
        setActiveSettingsTab(event.detail.tab)
      }
    }
    window.addEventListener('settings-tab-request', handleTabEvent)
    window.addEventListener('settings-tab-change', handleTabEvent)
    return () => {
      window.removeEventListener('settings-tab-request', handleTabEvent)
      window.removeEventListener('settings-tab-change', handleTabEvent)
    }
  }, [])

  // Calendar sidebar state
  const [calendarOpen, setCalendarOpen] = useState(() => pathname.startsWith('/calendar'))
  const [calendarData, setCalendarData] = useState<CalendarSidebarData[]>([])
  const [calendarDataReceived, setCalendarDataReceived] = useState(false)
  const [visibleCalendarIds, setVisibleCalendarIds] = useState<Set<string>>(new Set())
  const [athleticsVisibleCampusIds, setAthleticsVisibleCampusIds] = useState<Set<string>>(new Set())
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(
    new Set(['MASTER', 'MY SCHEDULE'])
  )

  // Campus → shape index map (calendar)
  const campusShapeMap = useMemo(() => buildCampusShapeMap(calendarData), [calendarData])

  // Campus → shape index map (athletics) — built from athletics campus list
  const athleticsCampusShapeMap = useMemo(() => {
    const ids = athleticsCampuses.map((c) => c.id).sort()
    return new Map(ids.map((id, i) => [id, i % 5])) // 5 shapes in CAMPUS_SHAPES
  }, [athleticsCampuses])

  // Meet with state
  const [meetWithPeople, setMeetWithPeople] = useState<MeetWithPerson[]>([])

  const handleMeetWithAdd = useCallback((person: MeetWithPerson) => {
    setMeetWithPeople((prev) => {
      if (prev.length >= 5 || prev.some((p) => p.id === person.id)) return prev
      const next = [...prev, person]
      window.dispatchEvent(new CustomEvent('meet-with-change', { detail: { people: next } }))
      return next
    })
  }, [])

  const handleMeetWithRemove = useCallback((personId: string) => {
    setMeetWithPeople((prev) => {
      const next = prev.filter((p) => p.id !== personId)
      window.dispatchEvent(new CustomEvent('meet-with-change', { detail: { people: next } }))
      return next
    })
  }, [])

  // Three-dot menu state
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameCancelledRef = useRef(false)
  const [colorEditId, setColorEditId] = useState<string | null>(null)
  const [deleteCalendar, setDeleteCalendar] = useState<CalendarSidebarData | null>(null)

  // Open events panel when navigating to /events, /calendar, or /planning
  useIsomorphicLayoutEffect(() => {
    if (pathname.startsWith('/events') || pathname.startsWith('/calendar') || pathname.startsWith('/planning')) {
      setEventsOpen(true)
      setSettingsOpen(false)
      setAthleticsOpen(false)
    }
  }, [pathname])

  // Open calendar panel when navigating to /calendar (kept for backward compat — calendarOpen is still used for calendar checkbox data)
  useIsomorphicLayoutEffect(() => {
    if (pathname.startsWith('/calendar')) {
      setCalendarOpen(true)
      setSettingsOpen(false)
      setAthleticsOpen(false)
    } else {
      setCalendarOpen(false)
    }
  }, [pathname])

  // Open athletics panel when navigating to /athletics
  useIsomorphicLayoutEffect(() => {
    if (pathname.startsWith('/athletics')) {
      setAthleticsOpen(true)
      setSettingsOpen(false)
      setCalendarOpen(false)
      setEventsOpen(false)
    } else {
      setAthleticsOpen(false)
    }
  }, [pathname])

  // Auto-expand facilities section when on a maintenance route (includes /inventory?dept=maintenance)
  useIsomorphicLayoutEffect(() => {
    if (isMaintenancePath(pathname, pageSearchParams)) {
      setFacilitiesOpen(true)
      setItOpen(false)
    }
  }, [pathname, pageSearchParams])

  // Auto-expand IT section when on an IT route (includes /inventory?dept=it)
  useIsomorphicLayoutEffect(() => {
    if (isITPath(pathname, pageSearchParams)) {
      setItOpen(true)
      setFacilitiesOpen(false)
    }
  }, [pathname, pageSearchParams])

  // Permissions — declared here (before the indicator effect) so the effect
  // can include them in its dependency array without a temporal dead zone error.
  const { data: perms } = usePermissions()

  // ── Optimistic sidebar rendering ──────────────────────────────────────────
  // Maintenance, IT Help Desk, and AV Inventory are core features. Their
  // sidebar links should appear INSTANTLY — not after the permissions API
  // resolves. We cache team slugs in localStorage and read them on mount so
  // the Support section renders in the very first paint.
  //
  // Once the real `perms` object arrives the values are replaced with ground
  // truth. The only edge case where a link could flash and disappear is a
  // custom role with zero maintenance/IT access — very rare.

  // Read cached role + teams from localStorage (synchronous, no round-trip)
  const optimisticRole = (() => {
    if (typeof window === 'undefined') return ''
    return (localStorage.getItem('user-role') || '').toLowerCase()
  })()
  const optimisticIsAdmin = optimisticRole.includes('admin') || optimisticRole.includes('super')

  const optimisticTeamSlugs = (() => {
    if (typeof window === 'undefined') return [] as string[]
    try {
      return JSON.parse(localStorage.getItem('user-team-slugs') || '[]') as string[]
    } catch {
      return [] as string[]
    }
  })()

  // Cache team slugs whenever permissions load/update
  useEffect(() => {
    if (perms?.userTeams) {
      const slugs = perms.userTeams.map((t) => t.slug)
      localStorage.setItem('user-team-slugs', JSON.stringify(slugs))
    }
  }, [perms?.userTeams])

  // Workspace settings (existing pattern, now using shared optimisticIsAdmin)
  const canManageWorkspace = perms?.canManageWorkspace ?? optimisticIsAdmin

  // Maintenance permissions — optimistic: all default roles have at least submit
  const canManageMaintenance = perms?.canManageMaintenance ?? optimisticIsAdmin
  const canClaimMaintenance = perms?.canClaimMaintenance ?? optimisticIsAdmin
  const canSubmitMaintenance = perms?.canSubmitMaintenance ?? true // all roles can submit
  // IT permissions — optimistic: all default roles have at least submit
  const canManageIT = perms?.canManageIT ?? optimisticIsAdmin
  const canSubmitIT = perms?.canSubmitIT ?? true // all roles can submit
  // IT sub-section permissions (fine-grained — only optimistic for admins)
  const canReadDevices = perms?.canReadDevices ?? optimisticIsAdmin
  const canReadStudents = perms?.canReadStudents ?? optimisticIsAdmin
  const canAccessLoaners = (perms?.canManageLoaners ?? false) || (perms?.canCheckoutLoaner ?? false) || (perms?.canCheckinLoaner ?? false)
  const canAccessDeployment = (perms?.canManageDeployment ?? false) || (perms?.canProcessDeployment ?? false)
  const canAccessProvisioning = (perms?.canManageProvisioning ?? false) || (perms?.canViewProvisioning ?? false)
  const canViewContentFilters = (perms?.canViewCIPAAudit ?? false) || (perms?.canConfigureFilters ?? false) || (perms?.canManageFilters ?? false)
  const canViewSecurityIncidents = perms?.canViewSecurityIncidents ?? false
  const canViewIntelligence = perms?.canViewIntelligence ?? false
  const canViewITAnalytics = perms?.canViewITAnalytics ?? false
  const canViewITBoardReports = perms?.canViewITBoardReports ?? false
  const canViewERate = (perms?.canManageERate ?? false) || (perms?.canViewERate ?? false)
  const canManageSync = perms?.canManageSync ?? false
  const canSeeITDevices = canReadDevices || canReadStudents || canAccessLoaners
  const canSeeITLifecycle = canAccessDeployment || canAccessProvisioning || canManageIT
  const canSeeITSecurity = canViewContentFilters || canViewSecurityIncidents || canViewIntelligence
  const canSeeITAdmin = canViewITAnalytics || canViewITBoardReports || canViewERate || canManageSync

  // Inventory — optimistic for admins
  const canReadInventory = perms?.canReadInventory ?? optimisticIsAdmin

  // Team membership — use cached slugs as fallback while perms load
  const isOnMaintenanceTeam = perms ? isOnTeam(perms, 'maintenance') : optimisticTeamSlugs.includes('maintenance')
  const isOnITTeam = perms ? isOnTeam(perms, 'it-support') : optimisticTeamSlugs.includes('it-support')
  const isOnAVTeam = perms ? isOnTeam(perms, 'av-production') : optimisticTeamSlugs.includes('av-production')

  // Pending event approval counts for sidebar badges
  const canApproveFacilitiesGate = isOnMaintenanceTeam || canManageMaintenance
  const canApproveAVGate = isOnAVTeam || canManageWorkspace
  const { data: facilitiesGateCount } = usePendingGateCount('facilities', canApproveFacilitiesGate)
  const { data: avGateCount } = usePendingGateCount('av', canApproveAVGate)

  // Measure and position the facilities indicator.
  //
  // Uses useLayoutEffect so positioning happens BEFORE the browser paints,
  // eliminating the flash caused by the indicator being invisible for a frame.
  //
  // Position memory is stored in module-level variables (_facilityLastPos,
  // _facilityMeasured) which survive component remounts (DashboardLayout
  // lives in page.tsx, so Sidebar remounts on every navigation).
  //
  // Framer Motion's animate() handles the glide animation independently
  // of React's render cycle.
  useLayoutEffect(() => {
    // Check the ref directly instead of facilityContainerMounted state,
    // because the callback ref fires before useLayoutEffect but the
    // setState from it hasn't triggered a re-render yet.
    const container = facilitiesContainerRef.current
    if (!container) return

    if (!facilitiesOpen) {
      indicatorOpacity.jump(0)
      return
    }

    const alreadyMeasured = _facilityMeasured

    const positionIndicator = (shouldAnimate: boolean): boolean => {
      if (!container) return false

      const activeEl = container.querySelector('[data-facility-active="true"]') as HTMLElement | null
      if (!activeEl) {
        indicatorOpacity.jump(0)
        _facilityLastPos = null
        return true
      }

      const height = activeEl.offsetHeight
      if (height < 1) return false // element not laid out yet

      // Walk offsetTop chain to get position relative to container
      let top = 0
      let walker: HTMLElement | null = activeEl
      while (walker && walker !== container) {
        top += walker.offsetTop
        walker = walker.offsetParent as HTMLElement | null
      }

      const prev = _facilityLastPos
      const easing = [0.22, 1, 0.36, 1] as [number, number, number, number]

      // If already at the target position, just ensure visibility and bail.
      // This prevents a duplicate layout effect run (triggered by
      // facilityContainerMounted state change) from calling jump() and
      // killing an in-progress animation.
      if (prev && prev.top === top && prev.height === height) {
        indicatorOpacity.jump(1)
        return true
      }

      if (!shouldAnimate || !prev) {
        // First time ever: snap into position (no animation)
        indicatorTop.jump(top)
        indicatorHeight.jump(height)
        indicatorOpacity.jump(1)
      } else {
        // Subsequent navigation: jump to old position, then animate to new.
        indicatorTop.jump(prev.top)
        indicatorHeight.jump(prev.height)
        indicatorOpacity.jump(1)

        fmAnimate(indicatorTop, top, { duration: 0.4, ease: easing })
        fmAnimate(indicatorHeight, height, { duration: 0.4, ease: easing })

        // ── Glow trail: spans from old position to new, then fades out ──
        const trail = facilityTrailRef.current
        if (trail) {
          const movingDown = top > prev.top
          const trailTop = Math.min(prev.top, top)
          const trailBottom = Math.max(prev.top + prev.height, top + height)
          const trailHeight = trailBottom - trailTop

          trail.style.transition = 'none'
          trail.style.top = `${trailTop}px`
          trail.style.height = `${trailHeight}px`
          trail.style.opacity = '0.7'
          trail.style.background = movingDown
            ? 'linear-gradient(180deg, rgba(59,130,246,0) 0%, rgba(59,130,246,0.5) 40%, rgba(99,102,241,0.6) 100%)'
            : 'linear-gradient(0deg, rgba(59,130,246,0) 0%, rgba(59,130,246,0.5) 40%, rgba(99,102,241,0.6) 100%)'
          trail.offsetHeight // force reflow
          trail.style.transition = 'opacity 0.55s ease-out'
          trail.style.opacity = '0'
        }
      }

      _facilityLastPos = { top, height }
      return true
    }

    // Try immediately (useLayoutEffect runs before paint, so no flash).
    const immediateSuccess = positionIndicator(alreadyMeasured)
    if (immediateSuccess) {
      _facilityMeasured = true
    }

    // Always set fallback timeouts — even if immediate succeeded with "no active element",
    // permission-gated links may appear shortly after (async permission load).
    const t1 = setTimeout(() => {
      if (positionIndicator(alreadyMeasured)) _facilityMeasured = true
    }, 80)
    const t2 = setTimeout(() => {
      if (indicatorOpacity.get() < 0.5) {
        positionIndicator(false)
        _facilityMeasured = true
      }
    }, 350)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [facilitiesOpen, facilityContainerMounted, pathname, pageSearchParams, canManageMaintenance, canClaimMaintenance, indicatorTop, indicatorHeight, indicatorOpacity])

  // ── IT indicator positioning (mirrors facilities indicator) ──
  useLayoutEffect(() => {
    const container = itContainerRef.current
    if (!container) return

    if (!itOpen) {
      itIndicatorOpacity.jump(0)
      return
    }

    const alreadyMeasured = _itMeasured

    const positionIndicator = (shouldAnimate: boolean): boolean => {
      if (!container) return false

      const activeEl = container.querySelector('[data-it-active="true"]') as HTMLElement | null
      if (!activeEl) {
        itIndicatorOpacity.jump(0)
        _itLastPos = null
        return true
      }

      const height = activeEl.offsetHeight
      if (height < 1) return false

      let top = 0
      let walker: HTMLElement | null = activeEl
      while (walker && walker !== container) {
        top += walker.offsetTop
        walker = walker.offsetParent as HTMLElement | null
      }

      const prev = _itLastPos
      const easing = [0.22, 1, 0.36, 1] as [number, number, number, number]

      if (prev && prev.top === top && prev.height === height) {
        itIndicatorOpacity.jump(1)
        return true
      }

      if (!shouldAnimate || !prev) {
        itIndicatorTop.jump(top)
        itIndicatorHeight.jump(height)
        itIndicatorOpacity.jump(1)
      } else {
        itIndicatorTop.jump(prev.top)
        itIndicatorHeight.jump(prev.height)
        itIndicatorOpacity.jump(1)

        fmAnimate(itIndicatorTop, top, { duration: 0.4, ease: easing })
        fmAnimate(itIndicatorHeight, height, { duration: 0.4, ease: easing })

        const trail = itTrailRef.current
        if (trail) {
          const movingDown = top > prev.top
          const trailTop = Math.min(prev.top, top)
          const trailBottom = Math.max(prev.top + prev.height, top + height)
          const trailHeight = trailBottom - trailTop

          trail.style.transition = 'none'
          trail.style.top = `${trailTop}px`
          trail.style.height = `${trailHeight}px`
          trail.style.opacity = '0.7'
          trail.style.background = movingDown
            ? 'linear-gradient(180deg, rgba(59,130,246,0) 0%, rgba(59,130,246,0.5) 40%, rgba(99,102,241,0.6) 100%)'
            : 'linear-gradient(0deg, rgba(59,130,246,0) 0%, rgba(59,130,246,0.5) 40%, rgba(99,102,241,0.6) 100%)'
          trail.offsetHeight // force reflow
          trail.style.transition = 'opacity 0.55s ease-out'
          trail.style.opacity = '0'
        }
      }

      _itLastPos = { top, height }
      return true
    }

    const immediateSuccess = positionIndicator(alreadyMeasured)
    if (immediateSuccess) {
      _itMeasured = true
    }

    // Always set fallback timeouts — even if immediate succeeded with "no active element",
    // permission-gated links may appear shortly after (async permission load).
    const t1 = setTimeout(() => {
      if (positionIndicator(alreadyMeasured)) _itMeasured = true
    }, 80)
    const t2 = setTimeout(() => {
      if (itIndicatorOpacity.get() < 0.5) {
        positionIndicator(false)
        _itMeasured = true
      }
    }, 350)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [itOpen, itContainerMounted, pathname, pageSearchParams, canManageIT, canSubmitIT, itIndicatorTop, itIndicatorHeight, itIndicatorOpacity])

  // Listen for calendar data from the calendar page
  useEffect(() => {
    const handleCalendarData = (e: Event) => {
      const event = e as CustomEvent<{ calendars: CalendarSidebarData[]; visibleIds: string[] }>
      if (event.detail?.calendars) {
        setCalendarData(event.detail.calendars)
        setVisibleCalendarIds(new Set(event.detail.visibleIds))
        setCalendarDataReceived(true)
      }
    }
    const handleVisibilityChange = (e: Event) => {
      const event = e as CustomEvent<{ visibleIds: string[] }>
      if (event.detail?.visibleIds) {
        setVisibleCalendarIds(new Set(event.detail.visibleIds))
      }
    }
    window.addEventListener('calendar-sidebar-data', handleCalendarData)
    window.addEventListener('calendar-visibility-change', handleVisibilityChange)
    return () => {
      window.removeEventListener('calendar-sidebar-data', handleCalendarData)
      window.removeEventListener('calendar-visibility-change', handleVisibilityChange)
    }
  }, [])

  // Listen for athletics sidebar data from the athletics page
  useEffect(() => {
    const handleAthleticsData = (e: Event) => {
      const event = e as CustomEvent<{
        campuses: AthleticsCampus[]
        activeCampusId: string | null
      }>
      if (event.detail) {
        setAthleticsCampuses(event.detail.campuses)
        if (event.detail.activeCampusId) setAthleticsCampusId(event.detail.activeCampusId)
      }
    }
    window.addEventListener('athletics-sidebar-data', handleAthleticsData)
    // Ask the athletics page to re-send data (in case it dispatched before we were ready)
    window.dispatchEvent(new CustomEvent('athletics-sidebar-request'))
    return () => {
      window.removeEventListener('athletics-sidebar-data', handleAthleticsData)
    }
  }, [])

  const toggleCalendarVisibility = (calendarId: string) => {
    setVisibleCalendarIds((prev) => {
      const next = new Set(prev)
      if (next.has(calendarId)) next.delete(calendarId)
      else next.add(calendarId)
      // Notify the calendar page
      window.dispatchEvent(
        new CustomEvent('calendar-toggle', { detail: { calendarId } })
      )
      return next
    })
  }

  const toggleCalendarType = (type: string) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  // Athletics calendar toggle — which campuses have athletics module enabled
  const athleticsEnabledCampusIds = useMemo(() => {
    return new Set(
      sidebarModules
        .filter((m: any) => m.moduleId === 'athletics' && m.campusId)
        .map((m: any) => m.campusId as string)
    )
  }, [sidebarModules])

  const toggleAthleticsCalendar = (campusId: string) => {
    setAthleticsVisibleCampusIds((prev) => {
      const next = new Set(prev)
      if (next.has(campusId)) next.delete(campusId)
      else next.add(campusId)
      window.dispatchEvent(
        new CustomEvent('athletics-calendar-toggle', {
          detail: { campusId, visible: !prev.has(campusId) },
        })
      )
      return next
    })
  }

  const handleCreateCalendar = () => {
    window.dispatchEvent(new CustomEvent('calendar-create-request'))
  }

  const handleRenameStart = (cal: CalendarSidebarData) => {
    setMenuOpenId(null)
    renameCancelledRef.current = false
    setRenamingId(cal.id)
    setRenameValue(cal.name)
  }

  const handleRenameSubmit = (calendarId: string) => {
    if (renameCancelledRef.current) return
    const trimmed = renameValue.trim()
    if (trimmed) {
      window.dispatchEvent(
        new CustomEvent('calendar-update', {
          detail: { calendarId, data: { name: trimmed } },
        })
      )
    }
    setRenamingId(null)
    setRenameValue('')
  }

  const handleRenameCancel = () => {
    renameCancelledRef.current = true
    setRenamingId(null)
    setRenameValue('')
  }

  const handleColorChangeStart = (calendarId: string) => {
    setMenuOpenId(null)
    setColorEditId(calendarId)
  }

  const handleColorSelect = (calendarId: string, color: string) => {
    window.dispatchEvent(
      new CustomEvent('calendar-update', {
        detail: { calendarId, data: { color } },
      })
    )
    setColorEditId(null)
  }

  const handleDeleteCalendar = (cal: CalendarSidebarData) => {
    setMenuOpenId(null)
    setDeleteCalendar(cal)
  }

  const confirmDeleteCalendar = () => {
    if (!deleteCalendar) return
    window.dispatchEvent(
      new CustomEvent('calendar-delete', {
        detail: { calendarId: deleteCalendar.id },
      })
    )
    setDeleteCalendar(null)
  }

  // Close menu/color picker when clicking outside
  useEffect(() => {
    if (!menuOpenId && !colorEditId) return
    const handleClickOutside = () => {
      setMenuOpenId(null)
      setColorEditId(null)
    }
    // Delay to avoid closing immediately on the same click
    const timer = setTimeout(() => {
      window.addEventListener('click', handleClickOutside)
    }, 0)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('click', handleClickOutside)
    }
  }, [menuOpenId, colorEditId])

  // Close user menu when clicking outside
  useEffect(() => {
    if (!userMenuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [userMenuOpen])

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/')

  const { enabled: athleticsEnabled, loading: athleticsModuleLoading } = useModuleEnabled('athletics')
  // Maintenance and IT Help Desk are now core features — no module gating needed

  const navItems = [
    { icon: Home, label: 'Dashboard', href: '/dashboard' },
  ]

  const handleEventsClick = () => {
    if (!eventsOpen) {
      setEventsOpen(true)
      setSettingsOpen(false)
      setAthleticsOpen(false)
      setCalendarOpen(false)
      router.push('/events')
    } else {
      setEventsOpen(false)
      router.push('/dashboard')
    }
  }

  const handleAthleticsClick = () => {
    if (!athleticsOpen) {
      setAthleticsOpen(true)
      setSettingsOpen(false)
      setCalendarOpen(false)
      setEventsOpen(false)
      router.push('/athletics')
    } else {
      setAthleticsOpen(false)
      router.push('/dashboard')
    }
  }

  const handleAthleticsCampusClick = (campusId: string) => {
    setAthleticsCampusId(campusId)
    window.dispatchEvent(
      new CustomEvent('athletics-campus-change', { detail: { campusId } })
    )
  }

  const handleSettingsClick = () => {
    if (!settingsOpen) {
      setSettingsOpen(true)
      setCalendarOpen(false)
      setAthleticsOpen(false)
      setEventsOpen(false)
      // Keep the last-used settings tab (stored in localStorage) instead of resetting
      router.push('/settings')
    } else {
      setSettingsOpen(false)
      router.push('/dashboard')
    }
  }

  const handleBackFromSettings = () => {
    setSettingsOpen(false)
    router.push('/dashboard')
  }

  const handleSettingsTabClick = (tab: SettingsTab) => {
    setActiveSettingsTab(tab)
    window.dispatchEvent(
      new CustomEvent('settings-tab-change', { detail: { tab } })
    )
  }

  const generalTabs = [
    { id: 'profile' as SettingsTab, label: 'My Profile', icon: User },
  ]

  const workspaceTabs = [
    { id: 'school-info' as SettingsTab, label: 'School Information', icon: School },
    { id: 'roles' as SettingsTab, label: 'Roles', icon: Shield },
    { id: 'teams' as SettingsTab, label: 'Teams', icon: Users },
    { id: 'users' as SettingsTab, label: 'Members', icon: UserCog },
    { id: 'campus' as SettingsTab, label: 'Campus', icon: Building2 },
    { id: 'billing' as SettingsTab, label: 'Billing', icon: CreditCard },
    { id: 'add-ons' as SettingsTab, label: 'Add-ons', icon: Puzzle },
    { id: 'integrations' as SettingsTab, label: 'Integrations', icon: Link2 },
    { id: 'activity-log' as SettingsTab, label: 'Activity Log', icon: ScrollText },
  ]

  const secondaryOpen = settingsOpen || calendarOpen || athleticsOpen || eventsOpen

  const mainNavContent = (
    <div className="flex flex-col h-full">
      {/* Organization Logo */}
      <div className="px-4 pt-8 pb-8 flex items-center justify-between">
        <div className="flex-1 min-w-0 flex items-center justify-center">
          {organizationLogoUrl ? (
            <img
              src={organizationLogoUrl}
              alt={`${organizationName || 'Organization'} logo`}
              className="h-10 max-w-[140px] object-contain"
            />
          ) : (
            <span className="text-base font-semibold text-slate-800 truncate">
              {organizationName || 'School'}
            </span>
          )}
        </div>
      </div>

      {/* Search Trigger */}
      <div className="px-4 pb-8">
        <button
          onClick={onSearchOpen}
          className="w-full h-9 rounded-xl border border-slate-300/60 bg-white/40 px-3 flex items-center gap-2 text-sm text-slate-500 hover:bg-white/60 hover:border-slate-400/50 transition cursor-pointer"
        >
          <Search className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-slate-500 bg-white/50 rounded border border-slate-300/50">
            &#8984;K
          </kbd>
        </button>
      </div>

      {/* SVG gradient for active nav icons */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="sidebar-icon-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>
        </defs>
      </svg>

      {/* Navigation Menu */}
      <nav className="p-4 pt-2 flex-1 overflow-y-auto" role="navigation" aria-label="Main navigation">
        <ul className="space-y-2" role="list">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <li key={item.href}>
                <PrefetchLink
                  href={item.href}
                  onClick={() => {
                    setSettingsOpen(false)
                    setAthleticsOpen(false)
                    setEventsOpen(false)
                    setIsOpen(false)
                    // calendarOpen is managed by route detection in useIsomorphicLayoutEffect
                  }}
                  className={`relative flex items-center gap-3 px-4 py-3 min-h-[44px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 rounded-xl ${
                    active && !settingsOpen && !athleticsOpen && !eventsOpen
                      ? 'text-slate-900 font-semibold bg-[rgb(236,241,252)]'
                      : 'text-slate-600 hover:bg-white/30 hover:text-slate-900 border border-transparent'
                  }`}
                  aria-current={active && !settingsOpen && !athleticsOpen && !eventsOpen ? 'page' : undefined}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${active && !settingsOpen && !athleticsOpen && !eventsOpen ? 'text-primary-500' : ''}`} aria-hidden="true" />
                  <span className="text-sm">{item.label}</span>
                </PrefetchLink>
              </li>
            )
          })}
          {/* Events — toggle secondary sidebar showing Dashboard, Calendar, Planning */}
          <li>
            <button
              onClick={() => {
                handleEventsClick()
                setIsOpen(false)
              }}
              className={`relative w-full flex items-center gap-3 px-4 py-3 min-h-[44px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 rounded-xl ${
                eventsOpen
                  ? 'text-slate-900 font-semibold bg-[rgb(236,241,252)]'
                  : 'text-slate-600 hover:bg-white/30 hover:text-slate-900 border border-transparent'
              }`}
              aria-current={eventsOpen ? 'page' : undefined}
            >
              <CalendarClock className={`w-5 h-5 flex-shrink-0 ${eventsOpen ? 'text-primary-500' : ''}`} aria-hidden="true" />
              <span className="text-sm">Events</span>
            </button>
          </li>
          {/* Athletics — toggle secondary sidebar (like Settings) */}
          {athleticsModuleLoading ? (
            <li>
              <div className="flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-lg animate-pulse">
                <div className="w-5 h-5 rounded bg-white/10 flex-shrink-0" />
                <div className="h-3.5 w-20 rounded bg-white/10" />
              </div>
            </li>
          ) : athleticsEnabled && perms?.canWriteAthletics ? (
            <li>
              <button
                onClick={() => {
                  handleAthleticsClick()
                  setIsOpen(false)
                }}
                onMouseEnter={() => {
                  if (athleticsPrefetched.current) return
                  athleticsPrefetched.current = true
                  queryClient.prefetchQuery(queryOptions.campuses()).catch(() => {})
                  queryClient.prefetchQuery(queryOptions.modules()).catch(() => {})
                  queryClient.prefetchQuery(queryOptions.calendars()).catch(() => {})
                }}
                className={`relative w-full flex items-center gap-3 px-4 py-3 min-h-[44px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 rounded-xl ${
                  athleticsOpen
                    ? 'text-slate-900 font-semibold bg-[rgb(236,241,252)]'
                    : 'text-slate-600 hover:bg-white/30 hover:text-slate-900 border border-transparent'
                }`}
                aria-current={athleticsOpen ? 'page' : undefined}
              >
                <Trophy className={`w-5 h-5 flex-shrink-0 ${athleticsOpen ? 'text-primary-500' : ''}`} aria-hidden="true" />
                <span className="text-sm">Athletics</span>
              </button>
            </li>
          ) : null}
        </ul>

        {/* Support section — always shown (Maintenance and IT Help Desk are core features) */}
        <>
          <div className="px-1 mt-4 mb-1">
            <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Support</span>
          </div>
            <ul className="space-y-1" role="list">
              {/* Facilities — collapsible section (no landing page; child links have content) */}
              {(isOnMaintenanceTeam || canManageMaintenance || canClaimMaintenance || canSubmitMaintenance) && (
                <li>
                  {(isOnMaintenanceTeam || canManageMaintenance || canClaimMaintenance) ? (
                  <>
                  {/* Section header — toggle only, no navigation */}
                  <button
                    onClick={() => {
                      setFacilitiesOpen((prev) => {
                        if (!prev) setItOpen(false)
                        return !prev
                      })
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl transition-colors duration-200 border border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
                      facilitiesOpen
                        ? 'text-slate-900 font-semibold bg-[rgb(236,241,252)]'
                        : 'text-slate-600 hover:bg-white/30 hover:text-slate-900'
                    }`}
                    aria-expanded={facilitiesOpen}
                    aria-label={facilitiesOpen ? 'Collapse maintenance' : 'Expand maintenance'}
                  >
                    <Wrench className={`w-5 h-5 flex-shrink-0 ${facilitiesOpen ? 'text-primary-500' : 'text-slate-600'}`} aria-hidden="true" />
                    <span className="text-sm">Maintenance</span>
                    <motion.span
                      className="ml-auto block"
                      animate={{ rotate: facilitiesOpen ? 180 : 0 }}
                      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                    >
                      <ChevronDown className="w-4 h-4 text-slate-400" aria-hidden="true" />
                    </motion.span>
                  </button>
                  {/* Child links — collapsible with animated gradient indicator.
                      Uses CSS max-height instead of AnimatePresence so the indicator
                      DOM element persists across navigations, enabling smooth CSS
                      transitions (exactly like the standalone HTML prototype). */}
                    <div
                      ref={facilitiesContainerRefCb}
                      className="relative ml-8 mt-1 overflow-hidden"
                      style={{
                        maxHeight: facilitiesOpen ? '600px' : '0px',
                        opacity: facilitiesOpen ? 1 : 0,
                        transition: 'max-height 0.25s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.2s ease',
                      }}
                    >
                          {/* Track line */}
                          <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-full bg-slate-300/40" />

                          {/* Glow trail — fading afterimage that spans the travel path.
                              NOTE: All mutable styles (opacity, top, height, background) are
                              managed imperatively via ref. Do NOT add them to the style prop
                              or React will reset them on every re-render. */}
                          <div
                            ref={facilityTrailRefCb}
                            className="absolute left-0 w-0.5 rounded-full pointer-events-none"
                            style={{ filter: 'blur(1.5px)' }}
                          />

                          {/* Animated gradient indicator — driven by Framer Motion values.
                              Uses useMotionValue + animate() so the animation runs
                              independently of React re-renders and component remounts. */}
                          <motion.div
                            className="absolute left-0 w-0.5 rounded-full pointer-events-none"
                            style={{
                              top: indicatorTop,
                              height: indicatorHeight,
                              opacity: indicatorOpacity,
                              background: 'linear-gradient(180deg, #3B82F6 0%, #6366F1 100%)',
                              boxShadow: '0 0 8px rgba(59, 130, 246, 0.5), 0 0 16px rgba(99, 102, 241, 0.25)',
                            }}
                          />

                          <div className="space-y-0.5">
                          {/* Dashboard */}
                          <PrefetchLink
                            href="/maintenance"
                            data-facility-active={pathname === '/maintenance' ? 'true' : undefined}
                            onClick={() => {
                              setSettingsOpen(false)
                              setAthleticsOpen(false)
                              setIsOpen(false)
                            }}
                            className={`flex items-center pl-4 pr-3 py-2.5 min-h-[40px] rounded-lg transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-2 ${
                              pathname === '/maintenance'
                                ? 'text-slate-900 font-medium'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                            aria-current={pathname === '/maintenance' ? 'page' : undefined}
                          >
                            <span className="text-sm">Maintenance Hub</span>
                          </PrefetchLink>
                          {/* Work Orders — visible to team members and admins with manage permission */}
                          {(isOnMaintenanceTeam || canManageMaintenance) && (
                              <PrefetchLink
                                href="/maintenance/work-orders"
                                data-facility-active={pathname === '/maintenance/work-orders' ? 'true' : undefined}
                                onClick={() => {
                                  setSettingsOpen(false)
                                  setAthleticsOpen(false)
                                  setIsOpen(false)
                                }}
                                className={`flex items-center pl-4 pr-3 py-2.5 min-h-[40px] rounded-lg transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-2 ${
                                  pathname === '/maintenance/work-orders'
                                    ? 'text-slate-900 font-medium'
                                    : 'text-slate-500 hover:text-slate-800'
                                }`}
                              >
                                <span className="text-sm">Work Orders</span>
                              </PrefetchLink>
                          )}
                          {/* Event Approvals — events needing Facilities sign-off */}
                          {(isOnMaintenanceTeam || canManageMaintenance) && (
                              <PrefetchLink
                                href="/maintenance/event-approvals"
                                data-facility-active={pathname === '/maintenance/event-approvals' ? 'true' : undefined}
                                onClick={() => {
                                  setSettingsOpen(false)
                                  setAthleticsOpen(false)
                                  setIsOpen(false)
                                }}
                                className={`flex items-center justify-between pl-4 pr-3 py-2.5 min-h-[40px] rounded-lg transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
                                  pathname === '/maintenance/event-approvals'
                                    ? 'text-slate-900 font-medium'
                                    : 'text-slate-500 hover:text-slate-800'
                                }`}
                                aria-current={pathname === '/maintenance/event-approvals' ? 'page' : undefined}
                              >
                                <span className="text-sm">Event Approvals</span>
                                {(facilitiesGateCount?.count ?? 0) > 0 && (
                                  <span className="ml-auto flex-shrink-0 min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold leading-none">
                                    {facilitiesGateCount!.count}
                                  </span>
                                )}
                              </PrefetchLink>
                          )}
                          {/* Inventory — visible to team members and admins with manage + read permission */}
                          {canReadInventory && (isOnMaintenanceTeam || canManageMaintenance) && (
                              <PrefetchLink
                                href="/inventory?dept=maintenance"
                                data-facility-active={pathname === '/inventory' && pageSearchParams.get('dept') === 'maintenance' ? 'true' : undefined}
                                onClick={() => {
                                  setSettingsOpen(false)
                                  setAthleticsOpen(false)
                                  setIsOpen(false)
                                }}
                                className={`flex items-center pl-4 pr-3 py-2.5 min-h-[40px] rounded-lg transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-2 ${
                                  pathname === '/inventory' && pageSearchParams.get('dept') === 'maintenance'
                                    ? 'text-slate-900 font-medium'
                                    : 'text-slate-500 hover:text-slate-800'
                                }`}
                                aria-current={pathname === '/inventory' && pageSearchParams.get('dept') === 'maintenance' ? 'page' : undefined}
                              >
                                <span className="text-sm">Inventory</span>
                              </PrefetchLink>
                          )}
                          {/* Assets — visible to team members and admins with manage permission */}
                          {(isOnMaintenanceTeam || canManageMaintenance) && (
                              <PrefetchLink
                                href="/maintenance/assets"
                                data-facility-active={pathname === '/maintenance/assets' ? 'true' : undefined}
                                onClick={() => {
                                  setSettingsOpen(false)
                                  setAthleticsOpen(false)
                                  setIsOpen(false)
                                }}
                                className={`flex items-center pl-4 pr-3 py-2.5 min-h-[40px] rounded-lg transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-2 ${
                                  pathname === '/maintenance/assets'
                                    ? 'text-slate-900 font-medium'
                                    : 'text-slate-500 hover:text-slate-800'
                                }`}
                                aria-current={pathname === '/maintenance/assets' ? 'page' : undefined}
                              >
                                <span className="text-sm">Assets</span>
                              </PrefetchLink>
                          )}
                          {/* Knowledge Base — visible to team members and admins */}
                          {(isOnMaintenanceTeam || canManageMaintenance || canClaimMaintenance) && (
                              <PrefetchLink
                                href="/maintenance/knowledge-base"
                                data-facility-active={pathname.startsWith('/maintenance/knowledge-base') ? 'true' : undefined}
                                onClick={() => {
                                  setSettingsOpen(false)
                                  setAthleticsOpen(false)
                                  setIsOpen(false)
                                }}
                                className={`flex items-center pl-4 pr-3 py-2.5 min-h-[40px] rounded-lg transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-2 ${
                                  pathname.startsWith('/maintenance/knowledge-base')
                                    ? 'text-slate-900 font-medium'
                                    : 'text-slate-500 hover:text-slate-800'
                                }`}
                                aria-current={pathname.startsWith('/maintenance/knowledge-base') ? 'page' : undefined}
                              >
                                <span className="text-sm">Knowledge Base</span>
                              </PrefetchLink>
                          )}
                          </div>
                    </div>
                  </>
                  ) : (
                    /* Submit-only users — simple link to maintenance */
                    <PrefetchLink
                      href="/maintenance"
                      onClick={() => {
                        setSettingsOpen(false)
                        setAthleticsOpen(false)
                        setIsOpen(false)
                      }}
                      className={`flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
                        pathname.startsWith('/maintenance') && !settingsOpen && !athleticsOpen
                          ? 'text-slate-900 font-medium'
                          : 'text-slate-600 hover:text-slate-900 border border-transparent'
                      }`}
                      style={pathname.startsWith('/maintenance') && !settingsOpen && !athleticsOpen ? { background: 'linear-gradient(135deg, #c8d4e4, #d4dbe8, #ddd8e8)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.5)' } : {}}
                      aria-current={pathname.startsWith('/maintenance') && !settingsOpen && !athleticsOpen ? 'page' : undefined}
                    >
                      <Wrench className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                      <span className="text-sm">Facilities</span>
                    </PrefetchLink>
                  )}
                </li>
              )}

              {/* IT Help Desk — collapsible section (core feature, no module gating) */}
              {(isOnITTeam || canManageIT || canSubmitIT) && (
                <li>
                  {(isOnITTeam || canManageIT) ? (
                  <>
                  {/* Section header — toggle only, no navigation */}
                  <button
                    onClick={() => {
                      setItOpen((prev) => {
                        if (!prev) setFacilitiesOpen(false)
                        return !prev
                      })
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl transition-colors duration-200 border border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
                      itOpen
                        ? 'text-slate-900 font-semibold bg-[rgb(236,241,252)]'
                        : 'text-slate-600 hover:bg-white/30 hover:text-slate-900'
                    }`}
                    aria-expanded={itOpen}
                    aria-label={itOpen ? 'Collapse IT Help Desk' : 'Expand IT Help Desk'}
                  >
                    <Monitor className={`w-5 h-5 flex-shrink-0 ${itOpen ? 'text-primary-500' : 'text-slate-600'}`} aria-hidden="true" />
                    <span className="text-sm">IT Help Desk</span>
                    <motion.span
                      className="ml-auto block"
                      animate={{ rotate: itOpen ? 180 : 0 }}
                      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                    >
                      <ChevronDown className="w-4 h-4 text-slate-400" aria-hidden="true" />
                    </motion.span>
                  </button>
                  {/* Child links with animated gradient indicator */}
                    <div
                      ref={itContainerRefCb}
                      className="relative ml-8 mt-1 overflow-hidden"
                      style={{
                        maxHeight: itOpen ? '600px' : '0px',
                        opacity: itOpen ? 1 : 0,
                        transition: 'max-height 0.25s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.2s ease',
                      }}
                    >
                          {/* Track line */}
                          <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-full bg-slate-300/40" />

                          {/* Glow trail */}
                          <div
                            ref={itTrailRefCb}
                            className="absolute left-0 w-0.5 rounded-full pointer-events-none"
                            style={{ filter: 'blur(1.5px)' }}
                          />

                          {/* Animated gradient indicator */}
                          <motion.div
                            className="absolute left-0 w-0.5 rounded-full pointer-events-none"
                            style={{
                              top: itIndicatorTop,
                              height: itIndicatorHeight,
                              opacity: itIndicatorOpacity,
                              background: 'linear-gradient(180deg, #3B82F6 0%, #6366F1 100%)',
                              boxShadow: '0 0 8px rgba(59, 130, 246, 0.5), 0 0 16px rgba(99, 102, 241, 0.25)',
                            }}
                          />

                          <div className="space-y-0.5">
                          {/* Help Desk */}
                          <PrefetchLink
                            href="/it"
                            data-it-active={pathname === '/it' ? 'true' : undefined}
                            onClick={() => {
                              setSettingsOpen(false)
                              setAthleticsOpen(false)
                              setFacilitiesOpen(false)
                              setIsOpen(false)
                            }}
                            className={`flex items-center pl-4 pr-3 py-2.5 min-h-[40px] rounded-lg transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-2 ${
                              pathname === '/it'
                                ? 'text-slate-900 font-medium'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                            aria-current={pathname === '/it' ? 'page' : undefined}
                          >
                            <span className="text-sm">Help Desk</span>
                          </PrefetchLink>
                          {/* Devices — visible to IT team members or users with device permissions */}
                          {(isOnITTeam || canSeeITDevices) && (
                              <PrefetchLink
                                href="/it/devices"
                                data-it-active={pathname === '/it/devices' ? 'true' : undefined}
                                onClick={() => {
                                  setSettingsOpen(false)
                                  setAthleticsOpen(false)
                                  setFacilitiesOpen(false)
                                  setIsOpen(false)
                                }}
                                className={`flex items-center pl-4 pr-3 py-2.5 min-h-[40px] rounded-lg transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-2 ${
                                  pathname === '/it/devices'
                                    ? 'text-slate-900 font-medium'
                                    : 'text-slate-500 hover:text-slate-800'
                                }`}
                              >
                                <span className="text-sm">Devices</span>
                              </PrefetchLink>
                          )}
                          {/* Lifecycle — visible to IT team members or users with lifecycle permissions */}
                          {(isOnITTeam || canSeeITLifecycle) && (
                              <PrefetchLink
                                href="/it/lifecycle"
                                data-it-active={pathname === '/it/lifecycle' ? 'true' : undefined}
                                onClick={() => {
                                  setSettingsOpen(false)
                                  setAthleticsOpen(false)
                                  setFacilitiesOpen(false)
                                  setIsOpen(false)
                                }}
                                className={`flex items-center pl-4 pr-3 py-2.5 min-h-[40px] rounded-lg transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-2 ${
                                  pathname === '/it/lifecycle'
                                    ? 'text-slate-900 font-medium'
                                    : 'text-slate-500 hover:text-slate-800'
                                }`}
                              >
                                <span className="text-sm">Lifecycle</span>
                              </PrefetchLink>
                          )}
                          {/* Security — visible to IT team members or users with security permissions */}
                          {(isOnITTeam || canSeeITSecurity) && (
                              <PrefetchLink
                                href="/it/security"
                                data-it-active={pathname === '/it/security' ? 'true' : undefined}
                                onClick={() => {
                                  setSettingsOpen(false)
                                  setAthleticsOpen(false)
                                  setFacilitiesOpen(false)
                                  setIsOpen(false)
                                }}
                                className={`flex items-center pl-4 pr-3 py-2.5 min-h-[40px] rounded-lg transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-2 ${
                                  pathname === '/it/security'
                                    ? 'text-slate-900 font-medium'
                                    : 'text-slate-500 hover:text-slate-800'
                                }`}
                              >
                                <span className="text-sm">Security</span>
                              </PrefetchLink>
                          )}
                          {/* Reports & Admin — visible to IT team members or users with admin permissions */}
                          {(isOnITTeam || canSeeITAdmin) && (
                              <PrefetchLink
                                href="/it/admin"
                                data-it-active={pathname === '/it/admin' ? 'true' : undefined}
                                onClick={() => {
                                  setSettingsOpen(false)
                                  setAthleticsOpen(false)
                                  setFacilitiesOpen(false)
                                  setIsOpen(false)
                                }}
                                className={`flex items-center pl-4 pr-3 py-2.5 min-h-[40px] rounded-lg transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-2 ${
                                  pathname === '/it/admin'
                                    ? 'text-slate-900 font-medium'
                                    : 'text-slate-500 hover:text-slate-800'
                                }`}
                              >
                                <span className="text-sm">Reports & Admin</span>
                              </PrefetchLink>
                          )}
                          {/* Inventory — visible to IT team members or users with read+manage permissions */}
                          {canReadInventory && (isOnITTeam || canManageIT) && (
                              <PrefetchLink
                                href="/inventory?dept=it"
                                data-it-active={pathname === '/inventory' && pageSearchParams.get('dept') === 'it' ? 'true' : undefined}
                                onClick={() => {
                                  setSettingsOpen(false)
                                  setAthleticsOpen(false)
                                  setFacilitiesOpen(false)
                                  setIsOpen(false)
                                }}
                                className={`flex items-center pl-4 pr-3 py-2.5 min-h-[40px] rounded-lg transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-2 ${
                                  pathname === '/inventory' && pageSearchParams.get('dept') === 'it'
                                    ? 'text-slate-900 font-medium'
                                    : 'text-slate-500 hover:text-slate-800'
                                }`}
                                aria-current={pathname === '/inventory' && pageSearchParams.get('dept') === 'it' ? 'page' : undefined}
                              >
                                <span className="text-sm">Inventory</span>
                              </PrefetchLink>
                          )}
                          </div>
                    </div>
                  </>
                  ) : (
                    /* Submit-only users — simple link to IT Help Desk (tickets view) */
                    <PrefetchLink
                      href="/it"
                      onClick={() => {
                        setSettingsOpen(false)
                        setAthleticsOpen(false)
                        setFacilitiesOpen(false)
                        setIsOpen(false)
                      }}
                      className={`flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
                        pathname.startsWith('/it')
                          ? 'text-slate-900 font-medium'
                          : 'text-slate-600 hover:text-slate-900 border border-transparent'
                      }`}
                      style={pathname.startsWith('/it') ? { background: 'linear-gradient(135deg, #c8d4e4, #d4dbe8, #ddd8e8)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.5)' } : {}}
                      aria-current={pathname.startsWith('/it') ? 'page' : undefined}
                    >
                      <Monitor className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                      <span className="text-sm">IT Help Desk</span>
                    </PrefetchLink>
                  )}
                </li>
              )}

              {/* AV Inventory — visible to AV team + admin + super-admin with inventory read permission */}
              {canReadInventory && (isOnAVTeam || canManageWorkspace) && (
                <li>
                  <PrefetchLink
                    href="/inventory"
                    onClick={() => {
                      setSettingsOpen(false)
                      setAthleticsOpen(false)
                      setFacilitiesOpen(false)
                      setItOpen(false)
                      setIsOpen(false)
                    }}
                    className={`flex items-center gap-3 px-4 py-3 min-h-[44px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 rounded-xl ${
                      pathname === '/inventory' && !pageSearchParams.get('dept')
                        ? 'text-slate-900 font-semibold bg-[rgb(236,241,252)]'
                        : 'text-slate-600 hover:bg-white/30 hover:text-slate-900 border border-transparent'
                    }`}
                    aria-current={pathname === '/inventory' && !pageSearchParams.get('dept') ? 'page' : undefined}
                  >
                    <Package className={`w-5 h-5 flex-shrink-0 ${pathname === '/inventory' && !pageSearchParams.get('dept') ? 'text-primary-500' : ''}`} aria-hidden="true" />
                    <span className="text-sm">AV Inventory</span>
                  </PrefetchLink>
                </li>
              )}

              {/* AV Event Approvals — events needing A/V sign-off */}
              {(isOnAVTeam || canManageWorkspace) && (
                <li>
                  <PrefetchLink
                    href="/av/event-approvals"
                    onClick={() => {
                      setSettingsOpen(false)
                      setAthleticsOpen(false)
                      setFacilitiesOpen(false)
                      setItOpen(false)
                      setIsOpen(false)
                    }}
                    className={`flex items-center gap-3 px-4 py-3 min-h-[44px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 rounded-xl ${
                      pathname === '/av/event-approvals'
                        ? 'text-slate-900 font-semibold bg-[rgb(236,241,252)]'
                        : 'text-slate-600 hover:bg-white/30 hover:text-slate-900 border border-transparent'
                    }`}
                    aria-current={pathname === '/av/event-approvals' ? 'page' : undefined}
                  >
                    <Calendar className={`w-5 h-5 flex-shrink-0 ${pathname === '/av/event-approvals' ? 'text-primary-500' : ''}`} aria-hidden="true" />
                    <span className="text-sm flex-1">AV Event Approvals</span>
                    {(avGateCount?.count ?? 0) > 0 && (
                      <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold leading-none">
                        {avGateCount!.count}
                      </span>
                    )}
                  </PrefetchLink>
                </li>
              )}
            </ul>
        </>
      </nav>

      {/* Footer — User Profile + 3-dot Menu + Logo */}
      <div className="pb-3 px-3">
        {/* Divider above user profile */}
        <div className="mx-3 mb-4 border-t border-slate-200/40" />
        {/* User Profile + 3-dot Menu */}
        <div className="relative" ref={userMenuRef}>
          <div className="flex items-center gap-3 px-3 py-2 min-w-0">
            <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold overflow-hidden text-sm flex-shrink-0 ring-2 ring-white/50">
              {userAvatar ? (
                <img src={userAvatar} alt={userName} className="w-9 h-9 rounded-full object-cover" />
              ) : (
                userName.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{userName}</p>
              <p className="text-xs text-slate-400 truncate">{userEmail}</p>
            </div>
            <button
              onClick={() => setUserMenuOpen(prev => !prev)}
              className="p-2 rounded-lg text-slate-400 hover:bg-white/30 hover:text-slate-700 transition-colors duration-200 cursor-pointer flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              aria-label="User menu"
              title="More options"
            >
              <MoreVertical className="w-[18px] h-[18px]" aria-hidden="true" />
            </button>
          </div>

          {/* Popup menu — opens upward */}
          <AnimatePresence>
            {userMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
                className="absolute bottom-full left-2 right-2 mb-2 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50"
              >
                {/* Settings */}
                <button
                  onClick={() => {
                    setUserMenuOpen(false)
                    handleSettingsClick()
                    setIsOpen(false)
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors duration-150 cursor-pointer"
                >
                  <Settings className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                  Settings
                </button>

                {/* View As — super-admin only */}
                {isSuperAdmin && !isImpersonating && (
                  <button
                    onClick={() => {
                      setUserMenuOpen(false)
                      setIsViewAsOpen(true)
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors duration-150 cursor-pointer"
                  >
                    <Eye className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                    View As
                  </button>
                )}

                {/* Help & Support */}
                <button
                  onClick={() => {
                    setUserMenuOpen(false)
                    setBugDialogOpen(true)
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors duration-150 cursor-pointer"
                >
                  <HelpCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                  Help & Support
                </button>

                {/* Divider */}
                <div className="border-t border-slate-100 my-1" />

                {/* Log Out */}
                <button
                  onClick={() => {
                    setUserMenuOpen(false)
                    onLogout?.()
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors duration-150 cursor-pointer"
                >
                  <LogOut className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                  Log Out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-200/20 my-2" />

        {/* Lionheart Logo */}
        <div className="flex justify-center">
          <img src="/logo.svg" alt="Lionheart" className="h-6 opacity-30" />
        </div>
      </div>
    </div>
  )

  const settingsNavContent = (
    <div className="flex flex-col h-full">
      {/* Settings Header */}
      <div className="px-5 py-4 border-b border-white/30">
        <h2 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Settings</h2>
      </div>

      {/* General Settings */}
      <div className="px-3 pt-4">
        <p className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase px-2 mb-2">
          General
        </p>
        <nav className="space-y-1" aria-label="General settings sections">
          {generalTabs.map((tab) => {
            const Icon = tab.icon
            const isTabActive = activeSettingsTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => handleSettingsTabClick(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl text-sm transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
                  isTabActive
                    ? 'text-slate-900 font-semibold bg-[rgb(236,241,252)]'
                    : 'text-slate-600 hover:bg-white/30 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isTabActive ? 'text-primary-500' : ''}`} />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Workspace Settings */}
      {canManageWorkspace && (
        <div className="px-3 pt-5 pb-4">
          <p className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase px-2 mb-2">
            Workspace
          </p>
          <nav className="space-y-1" aria-label="Workspace settings sections">
            {workspaceTabs.map((tab) => {
              const Icon = tab.icon
              const isTabActive = activeSettingsTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => handleSettingsTabClick(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl text-sm transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
                    isTabActive
                      ? 'text-slate-900 font-semibold bg-[rgb(236,241,252)]'
                      : 'text-slate-600 hover:bg-white/30 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${isTabActive ? 'text-primary-500' : ''}`} />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>
      )}
    </div>
  )

  // Group calendars into MASTER (non-personal) and MY SCHEDULE (personal)
  const masterCalendars = calendarData.filter((c) => c.calendarType !== 'PERSONAL')
  const personalCalendars = calendarData.filter((c) => c.calendarType === 'PERSONAL')

  const calendarSections = [
    { key: 'MASTER', label: 'Master', cals: masterCalendars },
    { key: 'MY SCHEDULE', label: 'My Schedule', cals: personalCalendars },
  ]

  const calendarNavContent = (
    <div className="flex flex-col h-full">
      {/* Calendar Header */}
      <div className="px-5 py-4 border-b border-white/30 flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Calendars</h2>
        {canManageWorkspace && (
          <button
            onClick={handleCreateCalendar}
            className="p-1 rounded-md hover:bg-white/50 text-slate-400 hover:text-primary-600 transition-colors"
            title="Create calendar"
            aria-label="Create calendar"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Calendar List — grouped by MASTER / MY SCHEDULE */}
      <div className="px-3 pt-4 flex-1 overflow-y-auto">
        {!calendarDataReceived && calendarData.length === 0 && (
          <div className="space-y-3 px-2 animate-pulse">
            <div className="h-3 w-16 bg-slate-200 rounded" />
            <div className="space-y-2 pl-2">
              <div className="h-4 w-32 bg-slate-200 rounded" />
              <div className="h-4 w-28 bg-slate-200 rounded" />
            </div>
            <div className="h-3 w-20 bg-slate-200 rounded mt-4" />
            <div className="space-y-2 pl-2">
              <div className="h-4 w-24 bg-slate-200 rounded" />
            </div>
          </div>
        )}
        {calendarSections.map(({ key, label, cals }) => {
          // Hide MASTER section if no calendars; always show MY SCHEDULE
          if (cals.length === 0 && key !== 'MY SCHEDULE') return null
          const isMySchedule = key === 'MY SCHEDULE'
          const isExpanded = isMySchedule || expandedTypes.has(key)
          return (
            <div key={key} className="mb-1">
              {isMySchedule ? (
                /* MY SCHEDULE — flat section label, no collapsible dropdown */
                <div className="flex items-center gap-1.5 w-full px-2 py-2 text-[10px] font-semibold tracking-widest text-slate-400 uppercase">
                  {label}
                </div>
              ) : (
                <button
                  onClick={() => toggleCalendarType(key)}
                  className="flex items-center gap-1.5 w-full px-2 py-2 text-[10px] font-semibold tracking-widest text-slate-400 uppercase hover:text-slate-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                >
                  <motion.span
                    animate={{ rotate: isExpanded ? 0 : -90 }}
                    transition={{ duration: 0.15 }}
                    className="inline-flex"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </motion.span>
                  {label}
                  <span className="ml-auto text-slate-300 normal-case tracking-normal font-normal text-xs">
                    {cals.length}
                  </span>
                </button>
              )}
              <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  className="space-y-0.5 overflow-hidden"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  {cals.length === 0 && isMySchedule && (
                    <div className="px-3 py-4 text-center">
                      <p className="text-xs text-slate-400">Your personal calendar will appear here</p>
                    </div>
                  )}
                  {cals.map((cal, calIdx) => {
                    // Track which campuses already rendered athletics toggle
                    // (render after the LAST calendar for that campus)
                    const campusId = cal.campus?.id
                    const hasAthletics = !isMySchedule && campusId && athleticsEnabledCampusIds.has(campusId)
                    const isLastCalForCampus = hasAthletics && !cals.slice(calIdx + 1).some((c) => c.campus?.id === campusId)
                    const isAthVisible = campusId ? athleticsVisibleCampusIds.has(campusId) : false
                    const isVisible = visibleCalendarIds.has(cal.id)
                    const isRenaming = renamingId === cal.id
                    const isColorEditing = colorEditId === cal.id
                    const isMenuOpen = menuOpenId === cal.id
                    // Show three-dot menu for admins or own personal calendars
                    // (API only returns the current user's personal calendar, so PERSONAL = own)
                    const canEditCal = canManageWorkspace || cal.calendarType === 'PERSONAL'

                    return (
                      <Fragment key={cal.id}>
                      <div className="relative group">
                        {isRenaming ? (
                          <div className="flex items-center gap-2 px-3 py-2">
                            <div
                              className="w-3 h-3 rounded-sm flex-shrink-0"
                              style={{ backgroundColor: cal.color }}
                            />
                            <input
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameSubmit(cal.id)
                                if (e.key === 'Escape') handleRenameCancel()
                              }}
                              onBlur={() => handleRenameSubmit(cal.id)}
                              className="flex-1 min-w-0 px-2 py-0.5 text-sm border border-primary-300 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-200 bg-white text-slate-700"
                              autoFocus
                            />
                          </div>
                        ) : isColorEditing ? (
                          <div className="px-3 py-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <div
                                className="w-3 h-3 rounded-sm flex-shrink-0"
                                style={{ backgroundColor: cal.color }}
                              />
                              <span className="truncate">{cal.calendarType === 'PERSONAL' ? 'My Calendar' : cal.name}</span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {COLOR_PRESETS.map((c) => (
                                <button
                                  key={c.value}
                                  type="button"
                                  onClick={() => handleColorSelect(cal.id, c.value)}
                                  className="w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-primary-400"
                                  style={{ backgroundColor: c.value }}
                                  title={c.name}
                                >
                                  {cal.color === c.value && (
                                    <Check className="w-3 h-3 text-white" />
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => toggleCalendarVisibility(cal.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                toggleCalendarVisibility(cal.id)
                              }
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition cursor-pointer ${
                              isVisible
                                ? 'text-slate-700 hover:bg-white/30'
                                : 'text-slate-400 hover:bg-white/30'
                            }`}
                            title={cal.calendarType === 'PERSONAL' ? 'My Calendar' : cal.name}
                          >
                            <div
                              className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center transition-colors"
                              style={{
                                backgroundColor: isVisible ? cal.color : 'transparent',
                                border: isVisible ? 'none' : `2px solid ${cal.color}`,
                              }}
                            >
                              {isVisible && <Check className="w-3 h-3 text-white" />}
                            </div>
                            {cal.campus && (
                              <CampusShapeIndicator
                                shapeIndex={getShapeIndex(campusShapeMap, cal.campus.id)}
                                color={cal.color}
                                size={12}
                              />
                            )}
                            <span className="truncate">{cal.calendarType === 'PERSONAL' ? 'My Calendar' : cal.name}</span>
                            {canEditCal && (
                              <button
                                type="button"
                                tabIndex={0}
                                aria-label={`Calendar options for ${cal.name}`}
                                aria-haspopup="menu"
                                aria-expanded={isMenuOpen}
                                className="ml-auto opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 rounded hover:bg-slate-200/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setColorEditId(null)
                                  if (renamingId) handleRenameCancel()
                                  setMenuOpenId(isMenuOpen ? null : cal.id)
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    setColorEditId(null)
                                    if (renamingId) handleRenameCancel()
                                    setMenuOpenId(isMenuOpen ? null : cal.id)
                                  }
                                }}
                              >
                                <MoreHorizontal className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
                              </button>
                            )}
                          </div>
                        )}

                        {/* Dropdown menu */}
                        {isMenuOpen && (
                          <div
                            role="menu"
                            aria-label={`Options for ${cal.name}`}
                            className="absolute right-2 bottom-0 translate-y-full z-modal w-40 bg-white rounded-lg shadow-medium border border-slate-200 py-1"
                            style={{ maxHeight: '200px' }}
                            ref={(el) => {
                              // Flip to above if overflowing bottom of viewport
                              if (el) {
                                const rect = el.getBoundingClientRect()
                                if (rect.bottom > window.innerHeight - 8) {
                                  el.style.bottom = 'auto'
                                  el.style.top = '0'
                                  el.style.transform = 'translateY(-100%)'
                                }
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              role="menuitem"
                              onClick={() => handleRenameStart(cal)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5 text-slate-400" />
                              Rename
                            </button>
                            <button
                              role="menuitem"
                              onClick={() => handleColorChangeStart(cal.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                              <Palette className="w-3.5 h-3.5 text-slate-400" />
                              Change Color
                            </button>
                            {canManageWorkspace && (
                              <button
                                role="menuitem"
                                onClick={() => handleDeleteCalendar(cal)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Athletics toggle — nested under campus calendar */}
                      {isLastCalForCampus && campusId && (
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleAthleticsCalendar(campusId)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              toggleAthleticsCalendar(campusId)
                            }
                          }}
                          className={`flex items-center gap-2.5 pr-3 py-2 rounded-xl text-sm transition cursor-pointer ${
                            isAthVisible
                              ? 'text-slate-700 hover:bg-white/30'
                              : 'text-slate-400 hover:bg-white/30'
                          }`}
                          title={`Athletics — ${cal.campus?.name || 'Campus'}`}
                        >
                          {/* Tree connector line */}
                          <div className="flex items-center ml-5">
                            <div className="w-3.5 h-5 border-l-2 border-b-2 border-slate-300/60 rounded-bl-sm -mt-3" />
                          </div>
                          <div
                            className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center transition-colors ml-0.5"
                            style={{
                              backgroundColor: isAthVisible ? '#f59e0b' : 'transparent',
                              border: isAthVisible ? 'none' : '2px solid #f59e0b',
                            }}
                          >
                            {isAthVisible && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <Trophy className="w-3.5 h-3.5 flex-shrink-0 text-amber-500 ml-1" />
                          <span className="truncate">Athletics</span>
                        </div>
                      )}
                      </Fragment>
                    )
                  })}
                </motion.div>
              )}
              </AnimatePresence>
            </div>
          )
        })}
        {calendarData.length === 0 && (
          <div className="text-center py-8 text-slate-400 text-xs">
            <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p>No calendars yet</p>
          </div>
        )}

        {/* Meet With Section */}
        {calendarDataReceived && (
          <div className="border-t border-slate-200 mt-2 pt-2">
            <MeetWithSection
              people={meetWithPeople}
              onAdd={handleMeetWithAdd}
              onRemove={handleMeetWithRemove}
            />
          </div>
        )}
      </div>

    </div>
  )

  // Fetch active event projects for sidebar display (only when events panel is open)
  const { data: sidebarEventProjects, isLoading: eventsLoading } = useQuery<EventProjectSummary[]>({
    queryKey: ['event-projects', { status: 'CONFIRMED,DRAFT', limit: 5 }],
    queryFn: async () => {
      const { fetchApi } = await import('@/lib/api-client')
      return fetchApi<EventProjectSummary[]>('/api/events/projects?limit=5')
    },
    enabled: eventsOpen,
    staleTime: 2 * 60_000,
  })

  const eventStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED': return 'bg-green-100 text-green-700'
      case 'PENDING_APPROVAL': return 'bg-yellow-100 text-yellow-700'
      case 'DRAFT': return 'bg-slate-100 text-slate-600'
      case 'CANCELLED': return 'bg-red-100 text-red-700'
      default: return 'bg-slate-100 text-slate-500'
    }
  }

  const eventStatusLabel = (status: string) => {
    switch (status) {
      case 'CONFIRMED': return 'Confirmed'
      case 'PENDING_APPROVAL': return 'Pending'
      case 'DRAFT': return 'Draft'
      case 'CANCELLED': return 'Cancelled'
      default: return status
    }
  }

  const eventsNavContent = (
    <div className="flex flex-col h-full">
      {/* Events Header */}
      <div className="px-5 py-4 border-b border-white/30 flex items-center gap-2">
        <CalendarClock className="w-5 h-5 text-primary-500 flex-shrink-0" aria-hidden="true" />
        <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Events</h2>
      </div>

      {/* Navigation Links */}
      <div className="px-3 pt-4 flex-shrink-0">
        <nav className="space-y-1" aria-label="Events navigation">
          {/* Events Hub link */}
          <PrefetchLink
            href="/events"
            onClick={() => setIsOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
              pathname === '/events'
                ? 'text-slate-900 font-semibold bg-[rgb(236,241,252)]'
                : 'text-slate-600 hover:bg-white/30 hover:text-slate-900'
            }`}
            aria-current={pathname === '/events' ? 'page' : undefined}
          >
            <Home className={`w-5 h-5 flex-shrink-0 ${pathname === '/events' ? 'text-primary-500' : ''}`} aria-hidden="true" />
            Events Hub
          </PrefetchLink>

          {/* Calendar link */}
          <PrefetchLink
            href="/calendar"
            onClick={() => setIsOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
              pathname.startsWith('/calendar')
                ? 'text-slate-900 font-semibold bg-[rgb(236,241,252)]'
                : 'text-slate-600 hover:bg-white/30 hover:text-slate-900'
            }`}
            aria-current={pathname.startsWith('/calendar') ? 'page' : undefined}
          >
            <Calendar className={`w-5 h-5 flex-shrink-0 ${pathname.startsWith('/calendar') ? 'text-primary-500' : ''}`} aria-hidden="true" />
            Calendar
          </PrefetchLink>

          {/* Planning link */}
          <PrefetchLink
            href="/planning"
            onClick={() => setIsOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
              pathname.startsWith('/planning')
                ? 'text-slate-900 font-semibold bg-[rgb(236,241,252)]'
                : 'text-slate-600 hover:bg-white/30 hover:text-slate-900'
            }`}
            aria-current={pathname.startsWith('/planning') ? 'page' : undefined}
          >
            <ScrollText className={`w-5 h-5 flex-shrink-0 ${pathname.startsWith('/planning') ? 'text-primary-500' : ''}`} aria-hidden="true" />
            Planning
          </PrefetchLink>

          {/* Create with Leo link */}
          <PrefetchLink
            href="/events/new/ai"
            onClick={() => setIsOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
              pathname.startsWith('/events/new/ai')
                ? 'text-slate-900 font-semibold bg-[rgb(236,241,252)]'
                : 'text-slate-600 hover:bg-white/30 hover:text-slate-900'
            }`}
            aria-current={pathname.startsWith('/events/new/ai') ? 'page' : undefined}
          >
            <Sparkles className={`w-5 h-5 flex-shrink-0 ${pathname.startsWith('/events/new/ai') ? 'text-primary-500' : ''}`} aria-hidden="true" />
            Create with Leo
          </PrefetchLink>
        </nav>
      </div>

    </div>
  )

  const athleticsNavContent = (
    <div className="flex flex-col h-full">
      {/* Athletics Header */}
      <div className="px-5 py-4 border-b border-white/30">
        <h2 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Athletics</h2>
      </div>

      {/* Campuses */}
      {athleticsCampuses.length > 0 && (
        <div className="px-3 pt-4">
          <p className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase px-2 mb-2">
            Campuses
          </p>
          <nav className="space-y-0.5" aria-label="Athletics campuses">
            {athleticsCampuses.map((campus) => {
              const isActiveCampus = athleticsCampusId === campus.id
              return (
                <button
                  key={campus.id}
                  onClick={() => handleAthleticsCampusClick(campus.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
                    isActiveCampus
                      ? 'bg-white/50 text-primary-600 font-medium'
                      : 'text-slate-500 hover:bg-white/30 hover:text-slate-700'
                  }`}
                >
                  <CampusShapeIndicator
                    shapeIndex={athleticsCampusShapeMap.get(campus.id) ?? 0}
                    color={campus.color}
                    size={14}
                  />
                  {campus.name}
                </button>
              )
            })}
          </nav>
        </div>
      )}

    </div>
  )

  return (
    <>
      {/* Mobile Menu Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-mobilenav p-2 min-h-[44px] min-w-[44px] rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        style={{ background: 'rgba(255, 255, 255, 0.5)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.6)' }}
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-slate-700" aria-hidden="true" />
        ) : (
          <Menu className="w-6 h-6 text-slate-700" aria-hidden="true" />
        )}
      </button>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-navbar cursor-pointer"
          onClick={() => setIsOpen(false)}
          role="presentation"
        />
      )}

      {/* Desktop Layout: Main Nav + Settings Secondary Nav */}
      <div className={`hidden lg:flex fixed left-0 top-0 h-screen z-sticky transition-shadow duration-300 ${secondaryOpen ? 'shadow-[4px_0_24px_-4px_rgba(100,116,139,0.18)]' : ''}`}>
        {/* Main Navigation Sidebar — Aura glass panel */}
        <aside
          className="flex flex-col w-64 text-slate-700 h-full relative z-10"
          style={{ background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRight: secondaryOpen ? 'none' : '1px solid rgba(200, 210, 225, 0.5)' }}
          aria-label="Sidebar navigation"
        >
          {mainNavContent}
        </aside>

        {/* Secondary Navigation — attached panel */}
        <aside
          className={`flex flex-col w-60 h-full transition-[max-width,opacity] duration-300 ease-in-out overflow-hidden ${
            secondaryOpen ? 'max-w-60 opacity-100' : 'max-w-0 opacity-0'
          }`}
          style={{ background: 'rgba(245, 247, 250, 0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRight: secondaryOpen ? '1px solid rgba(200, 210, 225, 0.5)' : 'none', borderLeft: secondaryOpen ? '1px solid rgba(200, 210, 225, 0.3)' : 'none' }}
          aria-label={eventsOpen ? 'Events navigation' : athleticsOpen ? 'Athletics navigation' : calendarOpen ? 'Calendar navigation' : 'Settings navigation'}
          aria-hidden={!secondaryOpen}
        >
          <div className="w-60 h-full">
            {eventsOpen ? eventsNavContent : athleticsOpen ? athleticsNavContent : calendarOpen ? calendarNavContent : settingsNavContent}
          </div>
        </aside>
      </div>

      {/* Mobile Layout: Sidebar */}
      <aside
        className={`lg:hidden fixed left-0 top-0 h-screen w-[85vw] max-w-[320px] text-slate-700 flex flex-col transition-transform duration-300 z-navbar ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderRight: '1px solid rgba(255, 255, 255, 0.55)' }}
        role="navigation"
        aria-label="Mobile navigation"
      >
        {mainNavContent}
        {(eventsOpen || calendarOpen || settingsOpen || athleticsOpen) && (
          <div className="flex-1 overflow-y-auto border-t border-slate-200/30">
            {eventsOpen ? eventsNavContent : athleticsOpen ? athleticsNavContent : calendarOpen ? calendarNavContent : settingsNavContent}
          </div>
        )}
      </aside>

      {/* Spacer for desktop layout - adjusts width based on secondary panel */}
      <div
        className={`hidden lg:block flex-shrink-0 transition-[width] duration-300 ease-in-out ${
          secondaryOpen ? 'w-[496px]' : 'w-[256px]'
        }`}
      />

      {/* Calendar delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteCalendar}
        onClose={() => setDeleteCalendar(null)}
        onConfirm={confirmDeleteCalendar}
        title="Delete Calendar"
        message={`Delete "${deleteCalendar?.name}"? All events in this calendar will be permanently removed.`}
        confirmText="Delete"
        variant="danger"
      />

      {/* Bug report dialog */}
      <ReportBugDialog isOpen={bugDialogOpen} onClose={() => setBugDialogOpen(false)} />

      {/* View As dialog — super-admin only */}
      <ViewAsDialog isOpen={isViewAsOpen} onClose={() => setIsViewAsOpen(false)} />
    </>
  )
}
