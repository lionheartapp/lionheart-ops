import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import AppTabContent from './components/AppTabContent'
import OnboardingModal from './components/OnboardingModal'
import { INITIAL_EVENTS, userStartedEventWithTicketSales } from './data/eventsData'
import {
  INITIAL_INVENTORY_ITEMS,
  INITIAL_INVENTORY_STOCK,
  checkItemsAvailable,
  getItemsByScope,
  getStockByScope,
} from './data/inventoryData'
import { DEFAULT_TEAMS, INITIAL_USERS, canCreate, canCreateEvent, canEdit, isFacilitiesTeam, isITTeam, isAVTeam, isSuperAdmin, getUserTeamIds, getTeamDisplayLabel, INVENTORY_TEAM_IDS, getTeamName, EVENT_SCHEDULING_MESSAGE } from './data/teamsData'
import { useOrgModules } from './context/OrgModulesContext'
import { getAuthToken, platformFetch, platformPost, setCurrentOrgId } from './services/platformApi'
import { getCachedBootstrap, setCachedBootstrap } from './lib/cacheBootstrap'

import FacilitiesRequestForm from './components/FacilitiesRequestForm'
import ITRequestForm from './components/ITRequestForm'
import { INITIAL_FORMS, INITIAL_SUBMISSIONS, createForm } from './data/formsData'
import { notifyTeamsForScheduledEvent } from './data/eventNotifications'

const EventCreatorModal = dynamic(() => import('./components/EventCreatorModal'))
const SmartEventModal = dynamic(() => import('./components/SmartEventModal'))
const EventLandingPageModal = dynamic(() => import('./components/EventLandingPageModal'))
const EventInfoModal = dynamic(() => import('./components/EventInfoModal'))
const CampusMapModal = dynamic(() => import('./components/CampusMapModal'))
const DrawerModal = dynamic(() => import('./components/DrawerModal'))
const FormBuilderModal = dynamic(() => import('./components/FormBuilderModal'))
const CommandBar = dynamic(() => import('./components/CommandBar'))
const AIFormModal = dynamic(() => import('./components/AIFormModal'))

const tabContent = {
  dashboard: { title: 'Dashboard', showAll: true },
  facilities: { title: 'Facilities', showAll: false },
  'facilities-my-tickets': { title: 'My Tickets', showAll: false },
  events: { title: 'Calendar', showAll: false },
  forms: { title: 'Forms', showAll: false },
  'it-support': { title: 'IT Support', showAll: false },
  'my-tickets': { title: 'My Tickets', showAll: false },
  inventory: { title: 'Inventory', showAll: false },
  'water-management': { title: 'Water Management', showAll: false },
  settings: { title: 'Settings', showAll: false },
}

const VALID_TABS = new Set(Object.keys(tabContent))

function getPathForTab(tab, settingsSection = 'account') {
  if (tab === 'dashboard') return '/app'
  if (tab === 'settings') return settingsSection && settingsSection !== 'account' ? `/app/settings/${settingsSection}` : '/app/settings'
  return `/app/${tab}`
}

function parsePathname(pathname) {
  if (!pathname || !pathname.startsWith('/app')) return { tab: 'dashboard', section: 'account' }
  const rest = pathname.replace(/^\/app\/?/, '')
  const segments = rest ? rest.split('/').filter(Boolean) : []
  const tab = segments[0] && VALID_TABS.has(segments[0]) ? segments[0] : 'dashboard'
  const section = tab === 'settings' && segments[1] ? segments[1] : 'account'
  return { tab, section }
}

function parseNavigation(pathname, searchParams) {
  const parsed = parsePathname(pathname)
  const queryTab = searchParams?.get?.('tab') || ''
  const querySection = searchParams?.get?.('section') || ''

  if (parsed.tab === 'dashboard' && queryTab && VALID_TABS.has(queryTab)) {
    return {
      tab: queryTab,
      section: queryTab === 'settings' ? (querySection || 'account') : 'account',
    }
  }

  if (parsed.tab === 'settings' && querySection) {
    return { tab: 'settings', section: querySection }
  }

  return parsed
}

export default function App() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const { hasWaterManagement, hasVisualCampus, hasAdvancedInventory, orgName, orgLogoUrl, orgWebsite, orgAddress, orgLatitude, orgLongitude, primaryColor, secondaryColor, trialDaysLeft, allowTeacherEventRequests, refreshOrg, loading: orgLoading } = useOrgModules()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [eventModalOpen, setEventModalOpen] = useState(false)
  const [smartEventModalOpen, setSmartEventModalOpen] = useState(false)
  const [landingPageModalOpen, setLandingPageModalOpen] = useState(false)
  const [liveEvent, setLiveEvent] = useState(null)
  const [editingEvent, setEditingEvent] = useState(null)
  const [events, setEvents] = useState(INITIAL_EVENTS)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [infoModalOpen, setInfoModalOpen] = useState(false)
  const [teams, setTeams] = useState(DEFAULT_TEAMS)
  const [users, setUsers] = useState(INITIAL_USERS)
  const [currentUser, setCurrentUser] = useState(INITIAL_USERS[0] ?? null) // actual logged-in user (set by auth)
  const [viewAsUser, setViewAsUser] = useState(null) // when set, we're "viewing as" this user
  const effectiveUser = viewAsUser ?? currentUser
  const [supportRequests, setSupportRequests] = useState([])
  const [inventoryItems, setInventoryItems] = useState(INITIAL_INVENTORY_ITEMS)
  const [inventoryStock, setInventoryStock] = useState(INITIAL_INVENTORY_STOCK)
  const [forms, setForms] = useState(INITIAL_FORMS)
  const [formSubmissions, setFormSubmissions] = useState(INITIAL_SUBMISSIONS)
  const [facilitiesDrawerOpen, setFacilitiesDrawerOpen] = useState(false)
  const [itDrawerOpen, setITDrawerOpen] = useState(false)
  const [formBuilderOpen, setFormBuilderOpen] = useState(false)
  const [formToEdit, setFormToEdit] = useState(null)
  const [formIdToFill, setFormIdToFill] = useState(null)
  const [formIdToPreview, setFormIdToPreview] = useState(null)
  const [formIdToViewResponses, setFormIdToViewResponses] = useState(null)
  const [aiFormModalOpen, setAIFormModalOpen] = useState(false)
  const [settingsSection, setSettingsSection] = useState('account')
  const [commandBarOpen, setCommandBarOpen] = useState(false)
  const [campusMapModalOpen, setCampusMapModalOpen] = useState(false)
  const [formsDataLoaded, setFormsDataLoaded] = useState(false)
  const [formsLoading, setFormsLoading] = useState(false)
  const [inventoryDataLoaded, setInventoryDataLoaded] = useState(false)
  const [inventoryLoading, setInventoryLoading] = useState(false)
  const [fullTicketsLoaded, setFullTicketsLoaded] = useState(false)
  const [fullEventsLoaded, setFullEventsLoaded] = useState(false)
  const [userBootstrapDone, setUserBootstrapDone] = useState(false)
  const [summaryBootstrapDone, setSummaryBootstrapDone] = useState(false)
  const [roomsFromApi, setRoomsFromApi] = useState([])
  const [roomsLoaded, setRoomsLoaded] = useState(false)
  const lastPushedPathRef = useRef(null)
  const hasSyncedFromUrlRef = useRef(false)

  const updateTicket = (ticketId, updates) => {
    if (typeof ticketId !== 'string' || ticketId.length < 10) return // Skip mock tickets (numeric id)
    platformFetch(`/api/tickets/${ticketId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((updated) => {
        if (updated) {
          setSupportRequests((prev) =>
            prev.map((t) => (String(t.id) === String(ticketId) ? { ...t, ...updated } : t))
          )
        }
      })
      .catch(() => {})
  }

  // Command Bar (K-Bar): Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandBarOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Sync active tab/settings -> URL when user navigates in-app (run first so ref is set before pathname effect)
  useEffect(() => {
    if (!hasSyncedFromUrlRef.current) return
    const desired = getPathForTab(activeTab, settingsSection)
    const current = (pathname ?? '').split('?')[0]
    if (current !== desired) {
      lastPushedPathRef.current = desired
      const params = new URLSearchParams(searchParams?.toString?.() || '')
      params.delete('tab')
      params.delete('section')
      const query = params.toString()
      router.replace(query ? `${desired}?${query}` : desired)
    }
  }, [activeTab, settingsSection])

  // Sync URL pathname -> active tab/settings (so refresh keeps you on the same page)
  useEffect(() => {
    const p = pathname ?? ''
    if (lastPushedPathRef.current != null && p.split('?')[0] !== lastPushedPathRef.current) return
    if (lastPushedPathRef.current != null) lastPushedPathRef.current = null
    const { tab, section } = parseNavigation(p, searchParams)
    setActiveTab(tab)
    setSettingsSection(section)
    hasSyncedFromUrlRef.current = true
  }, [pathname, searchParams])

  // Set org from URL so API calls include x-org-id (e.g. /app?orgId=xxx after setup)
  useEffect(() => {
    const orgId = searchParams?.get('orgId')?.trim()
    if (orgId) setCurrentOrgId(orgId)
  }, [searchParams])

  // Apply userName/userEmail from URL (fallback when coming from setup - API may not have loaded yet)
  useEffect(() => {
    const userName = searchParams.get('userName')
    const userEmail = searchParams.get('userEmail')
    if ((userName?.trim() || userEmail?.trim()) && currentUser?.id === 'u0') {
      const updates = {}
      if (userName?.trim()) updates.name = userName.trim()
      if (userEmail?.trim()) updates.email = userEmail.trim()
      if (Object.keys(updates).length > 0) {
        setCurrentUser((prev) => (prev ? { ...prev, ...updates } : prev))
        setUsers((prev) => {
          const idx = prev.findIndex((p) => p.id === 'u0')
          if (idx >= 0) return prev.map((p, i) => (i === idx ? { ...p, ...updates } : p))
          return prev
        })
      }
    }
  }, [searchParams])

  // Bootstrap: unified single request for user + tickets + events with local caching for instant loads
  useEffect(() => {
    if (!getAuthToken()) {
      setUserBootstrapDone(true)
      setSummaryBootstrapDone(true)
      return
    }
    
    let cancelled = false
    const toJson = (r) => (r.ok ? r.json() : null)
    
    // Load from cache immediately for instant first paint
    const cached = getCachedBootstrap()
    if (cached) {
      if (cached.user) {
        const userMe = {
          id: cached.user.id,
          name: cached.user.name ?? 'User',
          email: cached.user.email ?? '',
          teamIds: cached.user.teamIds ?? [],
          role: cached.user.role ?? 'super-admin',
        }
        setCurrentUser(userMe)
        setUsers((prev) => {
          const idx = prev.findIndex((p) => p.id === userMe.id)
          if (idx >= 0) return prev.map((p, i) => (i === idx ? { ...p, ...userMe } : p))
          const placeholderIdx = prev.findIndex((p) => p.id === 'u0')
          if (placeholderIdx >= 0) {
            return prev.map((p, i) => (i === placeholderIdx ? { ...userMe, positionTitle: p.positionTitle } : p))
          }
          return [userMe, ...prev]
        })
      }
      if (Array.isArray(cached.tickets)) setSupportRequests(cached.tickets)
      if (Array.isArray(cached.events)) {
        setEvents(cached.events.map((e) => ({
          id: e.id,
          name: e.name,
          description: e.description,
          date: e.date,
          time: e.startTime,
          endTime: e.endTime,
          location: e.location || 'TBD',
          owner: e.submittedBy,
          creator: e.submittedBy,
          watchers: [],
        })))
      }
      setUserBootstrapDone(true)
      setSummaryBootstrapDone(true)
    }
    
    // Fetch fresh data in background (will update UI with newer data if available)
    platformFetch('/api/bootstrap')
      .then(toJson)
      .then((data) => {
        if (cancelled || !data) return
        
        // Save to cache for next reload
        setCachedBootstrap({
          user: data.user,
          tickets: data.tickets || [],
          events: data.events || [],
          timestamp: Date.now(),
        })
        
        // Update UI with fresh data
        if (data.user) {
          const userMe = {
            id: data.user.id,
            name: data.user.name ?? 'User',
            email: data.user.email ?? '',
            teamIds: data.user.teamIds ?? [],
            role: data.user.role ?? 'super-admin',
          }
          setCurrentUser(userMe)
          setUsers((prev) => {
            const idx = prev.findIndex((p) => p.id === userMe.id)
            if (idx >= 0) return prev.map((p, i) => (i === idx ? { ...p, ...userMe } : p))
            const placeholderIdx = prev.findIndex((p) => p.id === 'u0')
            if (placeholderIdx >= 0) {
              return prev.map((p, i) => (i === placeholderIdx ? { ...userMe, positionTitle: p.positionTitle } : p))
            }
            return [userMe, ...prev]
          })
        }
        
        if (Array.isArray(data.tickets)) {
          setSupportRequests(data.tickets)
          setFullTicketsLoaded(false)
        }
        
        if (Array.isArray(data.events)) {
          setEvents(data.events.map((e) => ({
            id: e.id,
            name: e.name,
            description: e.description,
            date: e.date,
            time: e.startTime,
            endTime: e.endTime,
            location: e.location || 'TBD',
            owner: e.submittedBy,
            creator: e.submittedBy,
            watchers: [],
          })))
          setFullEventsLoaded(false)
        }
        
        // Mark bootstrap as done if we didn't load from cache
        if (!cached) {
          setUserBootstrapDone(true)
          setSummaryBootstrapDone(true)
        }
      })
      .catch(() => {
        // Network error - if we had cache, we're already loaded, otherwise mark done anyway
        if (!cached) {
          setUserBootstrapDone(true)
          setSummaryBootstrapDone(true)
        }
      })
    
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const needsFullTickets = activeTab === 'facilities' || activeTab === 'facilities-my-tickets' || activeTab === 'it-support' || activeTab === 'my-tickets'
    if (!getAuthToken() || !needsFullTickets || fullTicketsLoaded) return
    let cancelled = false
    platformFetch('/api/tickets')
      .then((r) => (r.ok ? r.json() : null))
      .then((ticketsData) => {
        if (cancelled || !Array.isArray(ticketsData)) return
        setSupportRequests(ticketsData)
        setFullTicketsLoaded(true)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [activeTab, fullTicketsLoaded])

  useEffect(() => {
    if (!getAuthToken() || activeTab !== 'events' || fullEventsLoaded) return
    let cancelled = false
    platformFetch('/api/events')
      .then((r) => (r.ok ? r.json() : null))
      .then((eventsData) => {
        if (cancelled || !Array.isArray(eventsData)) return
        setEvents(eventsData.map((e) => ({
          id: e.id,
          name: e.name,
          description: e.description,
          date: e.date,
          time: e.startTime,
          endTime: e.endTime,
          location: e.room?.name || e.location || 'TBD',
          owner: e.submittedBy?.name,
          creator: e.submittedBy?.name,
          watchers: [],
        })))
        setFullEventsLoaded(true)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [activeTab, fullEventsLoaded])

  // Load rooms only when event creation tools are used (not required for initial dashboard paint)
  useEffect(() => {
    if (!getAuthToken() || roomsLoaded || (!eventModalOpen && !smartEventModalOpen)) return
    let cancelled = false
    platformFetch('/api/rooms')
      .then((r) => (r.ok ? r.json() : null))
      .then((roomsData) => {
        if (cancelled) return
        if (Array.isArray(roomsData)) {
          setRoomsFromApi(roomsData)
          setRoomsLoaded(true)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [eventModalOpen, smartEventModalOpen, roomsLoaded])

  // Lazy load forms when user opens Forms tab
  useEffect(() => {
    if (!getAuthToken() || activeTab !== 'forms' || formsDataLoaded || formsLoading) return
    let cancelled = false
    setFormsLoading(true)
    const toJson = (r) => (r.ok ? r.json() : null)
    Promise.all([
      platformFetch('/api/forms').then(toJson),
      platformFetch('/api/forms/submissions').then(toJson),
    ]).then(([formsRes, submissionsRes]) => {
      if (cancelled) return
      if (Array.isArray(formsRes)) setForms(formsRes)
      if (Array.isArray(submissionsRes)) setFormSubmissions(submissionsRes)
      setFormsDataLoaded(true)
    }).catch(() => {}).finally(() => {
      setFormsLoading(false)
    })
    return () => { cancelled = true }
  }, [activeTab, formsDataLoaded, formsLoading])

  // Lazy load inventory when user opens Inventory tab (with timeout so spinner doesn't hang)
  useEffect(() => {
    if (!getAuthToken() || activeTab !== 'inventory' || inventoryDataLoaded) return
    let cancelled = false
    setInventoryLoading(true)
    const timeoutMs = 15000
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        setInventoryLoading(false)
        setInventoryDataLoaded(true)
      }
    }, timeoutMs)
    platformFetch('/api/inventory')
      .then((r) => (r.ok ? r.json() : null))
      .then((invData) => {
        if (cancelled) return
        if (Array.isArray(invData?.items)) setInventoryItems(invData.items)
        if (Array.isArray(invData?.stock)) setInventoryStock(invData.stock)
        setInventoryDataLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setInventoryDataLoaded(true)
      })
      .finally(() => {
        clearTimeout(timeoutId)
        if (!cancelled) setInventoryLoading(false)
      })
    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [activeTab, inventoryDataLoaded])

  // Fetch full member list for Admin/Super Admin (after /me so we know role)
  useEffect(() => {
    if (!getAuthToken() || !currentUser?.id) return
    const role = (currentUser.role || '').toLowerCase()
    if (role !== 'admin' && role !== 'super-admin') return
    let cancelled = false
    platformFetch('/api/admin/users')
      .then((r) => (r.ok ? r.json() : null))
      .then((list) => {
        if (cancelled || !Array.isArray(list)) return
        const mapped = list.map((u) => ({
          id: u.id,
          name: u.name ?? u.email?.split('@')[0] ?? 'User',
          email: u.email ?? '',
          teamIds: u.teamIds ?? [],
          role: (u.role || '').toLowerCase().replace('_', '-'),
        }))
        setUsers(mapped)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [currentUser?.id, currentUser?.role])

  const openEventInfo = (ev) => {
    setSelectedEvent(ev)
    setInfoModalOpen(true)
  }

  const closeEventInfo = () => {
    setInfoModalOpen(false)
    setSelectedEvent(null)
  }

  const handleEventInfoEdit = (ev) => {
    setEditingEvent(ev)
    setLiveEvent({
      name: ev.name,
      description: ev.description,
      date: ev.date,
      location: ev.location,
    })
    setEventModalOpen(true)
    closeEventInfo()
  }

  const handleEventInfoDelete = (ev) => {
    if (typeof window !== 'undefined' && !window.confirm(`Delete "${ev.name}"? This cannot be undone.`)) return
    setEvents((prev) => prev.filter((e) => e.id !== ev.id))
    closeEventInfo()
  }

  const handleEventInfoCancel = (ev) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === ev.id ? { ...e, status: 'cancelled' } : e))
    )
    setSelectedEvent((cur) => (cur?.id === ev.id ? { ...cur, status: 'cancelled' } : cur))
  }

  const handleEventUpdate = (next) => {
    if (typeof next === 'function') {
      setLiveEvent((prev) => ({ ...prev, ...next(prev) }))
      return
    }
    setLiveEvent((prev) => ({ ...prev, ...next }))
  }

  const current = tabContent[activeTab]
  const showAll = current?.showAll ?? false
  const isFacilitiesUser = isFacilitiesTeam(effectiveUser, teams)
  const isITUser = isITTeam(effectiveUser, teams)
  const isAVUser = isAVTeam(effectiveUser, teams)
  const isSecurityUser = getUserTeamIds(effectiveUser).includes('security')
  const hasTeamInventory = isAVUser || isFacilitiesUser || isITUser || isSecurityUser
  const isSA = effectiveUser?.role === 'super-admin' || effectiveUser?.role === 'SUPER_ADMIN'
  const showInventory = hasAdvancedInventory && (hasTeamInventory || isSA)
  // Water Management: Maintenance team OR Super Admin only (hide from A/V, IT, Teachers, etc.)
  const showWaterManagementForUser = hasWaterManagement && (isFacilitiesUser || isSuperAdmin(effectiveUser))

  useEffect(() => {
    if (activeTab === 'water-management' && !showWaterManagementForUser) {
      setActiveTab('dashboard')
    }
  }, [activeTab, showWaterManagementForUser])

  const defaultInventoryScope = isAVUser ? 'av' : isFacilitiesUser ? 'facilities' : isITUser ? 'it' : isSecurityUser ? 'security' : null
  const [inventoryScopeOverride, setInventoryScopeOverride] = useState(null)
  const effectiveScope = defaultInventoryScope ?? (isSA ? 'av' : null)
  const inventoryScope = (isSA && inventoryScopeOverride) ? inventoryScopeOverride : (effectiveScope ?? 'facilities')

  const pageTitle =
    activeTab === 'facilities' && isFacilitiesUser
      ? 'Team Tickets'
      : activeTab === 'facilities-my-tickets'
        ? 'My Tickets'
        : activeTab === 'it-support' && isITUser
          ? 'Team Tickets'
          : activeTab === 'my-tickets'
            ? 'My Tickets'
            : current?.title ?? 'Dashboard'

  const isTrialActive = trialDaysLeft != null && trialDaysLeft > 0

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {isTrialActive && (
        <div className="shrink-0 rounded-none border-0 border-b border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-800/50 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {isSuperAdmin(effectiveUser) ? 'Your Pro Trial is active' : "You're in trial"}
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                You have <span className="font-medium text-amber-600 dark:text-amber-400">{trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''}</span> left{isSuperAdmin(effectiveUser) ? ' to explore all features.' : ' in the trial period.'}
              </p>
            </div>
          </div>
          {isSuperAdmin(effectiveUser) && (
            <button
              type="button"
              onClick={() => { setActiveTab('settings'); setSettingsSection('subscription') }}
              className="shrink-0 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
            >
              Add Payment Method
            </button>
          )}
        </div>
      )}
      <div className="flex flex-1 min-h-0">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        users={users}
        teams={teams}
        currentUser={effectiveUser}
        actualUser={currentUser}
        viewAsUser={viewAsUser}
        onViewAs={setViewAsUser}
        onClearViewAs={() => setViewAsUser(null)}
        showInventory={showInventory}
        showCampusMap={hasVisualCampus}
        showWaterManagement={showWaterManagementForUser}
        onOpenCampusMap={() => setCampusMapModalOpen(true)}
        orgName={orgName || searchParams.get('orgName')}
        orgLogoUrl={orgLogoUrl || searchParams.get('orgLogoUrl')}
        primaryColor={primaryColor}
        onNavigateToSettings={(section) => { setActiveTab('settings'); setSettingsSection(section || 'account') }}
      />

      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <TopBar
          currentUser={effectiveUser}
          teamLabel={getTeamDisplayLabel(effectiveUser, teams)}
          formSubmissions={formSubmissions}
          forms={forms}
          onNavigateToSettings={(section) => { setActiveTab('settings'); setSettingsSection(section || 'account') }}
          onNavigateToFormResponses={(formId) => {
            setFormIdToViewResponses(formId)
            setActiveTab('forms')
          }}
          onOpenCommandBar={() => setCommandBarOpen(true)}
        />
        <div className="flex-1 flex min-h-0 overflow-hidden gap-6 lg:gap-8">
        <div className="flex-1 min-w-0 overflow-auto flex flex-col min-h-0">
          <div
            className={`min-h-full flex flex-col min-h-0 w-full ${!['settings', 'water-management'].includes(activeTab) ? 'p-6 lg:p-8' : ''}`}
          >
            <AppTabContent
              tabState={{
                activeTab,
                pageTitle,
                showAll,
                events,
                setEvents,
                supportRequests,
                setSupportRequests,
                updateTicket,
                effectiveUser,
                users,
                teams,
                setTeams,
                setUsers,
                setEventModalOpen,
                setSmartEventModalOpen,
                setFormBuilderOpen,
                setFormToEdit,
                setForms,
                createForm,
                formSubmissions,
                setFormIdToViewResponses,
                setActiveTab,
                setSettingsSection,
                setFacilitiesDrawerOpen,
                setITDrawerOpen,
                setCampusMapModalOpen,
                setAIFormModalOpen,
                openEventInfo,
                handleEventInfoEdit,
                liveEvent,
                setLandingPageModalOpen,
                facilitiesDrawerOpen,
                itDrawerOpen,
                inventoryItems,
                inventoryStock,
                inventoryScope,
                inventoryScopeOverride,
                setInventoryScopeOverride,
                inventoryLoading,
                isSA,
                formsLoading,
                forms,
                setFormSubmissions,
                formIdToFill,
                setFormIdToFill,
                formIdToPreview,
                setFormIdToPreview,
                formIdToViewResponses,
                setFormIdToViewResponses,
                allowTeacherEventRequests,
                isFacilitiesUser,
                isITUser,
                showWaterManagementForUser,
                hasVisualCampus,
                hasTeamInventory,
                teams,
                orgLogoUrl,
                orgName,
                orgWebsite,
                orgAddress,
                orgLatitude,
                orgLongitude,
                orgLoading,
                refreshOrg,
                hasWaterManagement,
                settingsSection,
                searchParams,
                setInventoryItems,
                setInventoryStock,
              }}
            />
          {/* Tab content extracted to AppTabContent.jsx */}
          </div>
        </div>
        </div>
      </main>
      </div>

      {eventModalOpen && (
      <EventCreatorModal
        isOpen={eventModalOpen}
        onClose={() => {
          setEventModalOpen(false)
          setEditingEvent(null)
        }}
        onEventUpdate={handleEventUpdate}
        initialEvent={editingEvent}
        onSave={async (payload) => {
          const id = payload.id || String(Date.now())
          let roomId = payload.roomId
          if (!roomId && payload.location && roomsFromApi.length) {
            const room = roomsFromApi.find(
              (r) => r.name?.toLowerCase() === payload.location?.toLowerCase()
            )
            if (room) roomId = room.id
          }
          if (getAuthToken()) {
            try {
              const chairs = payload.facilitiesRequested?.find((f) => /chair/i.test(f.item || f.name || ''))?.quantity
              const tables = payload.facilitiesRequested?.find((f) => /table/i.test(f.item || f.name || ''))?.quantity
              await platformPost('/api/events', {
                name: payload.name,
                description: payload.description || undefined,
                date: payload.date,
                startTime: payload.time || '00:00',
                endTime: payload.endTime || undefined,
                roomId: roomId || undefined,
                chairsRequested: chairs ?? payload.chairsRequested,
                tablesRequested: tables ?? payload.tablesRequested,
                submittedById: effectiveUser?.id || undefined,
              })
            } catch {
              /* persist to local state regardless */
            }
          }
          const newEvent = {
            id,
            name: payload.name,
            description: payload.description,
            date: payload.date,
            location: payload.location,
            owner: payload.owner,
            creator: payload.creator,
            watchers: payload.watchers || [],
            hasTicketSales: payload.hasTicketSales,
            time: payload.time,
            endTime: payload.endTime,
            allDay: payload.allDay,
            category: payload.category,
            includeSetupTime: payload.includeSetupTime,
            setupTimeDate: payload.setupTimeDate,
            setupTimeTime: payload.setupTimeTime,
            isPaid: payload.isPaid,
            needsSignup: payload.needsSignup,
            facilitiesRequested: payload.facilitiesRequested,
            techRequested: payload.techRequested,
            repeatEnabled: payload.repeatEnabled,
            repeatRule: payload.repeatRule,
            communications: payload.communications,
          }
          const createTicket = async (payload) => {
            try {
              const res = await platformPost('/api/tickets', payload)
              if (!res.ok) return null
              return await res.json()
            } catch {
              return null
            }
          }
          const eventWithNotifications = await notifyTeamsForScheduledEvent(newEvent, users, setSupportRequests, createTicket)
          const existing = events.find((e) => e.id === id)
          const merged = {
            ...eventWithNotifications,
            communications: eventWithNotifications.communications ?? existing?.communications ?? [],
          }
          setEvents((prev) => {
            if (existing) return prev.map((e) => (e.id === id ? merged : e))
            return [...prev, merged]
          })
          setLiveEvent(merged)
        }}
        onGenerateLandingPage={() => setLandingPageModalOpen(true)}
      />
      )}

      {smartEventModalOpen && (
      <SmartEventModal
        isOpen={smartEventModalOpen}
        onClose={() => setSmartEventModalOpen(false)}
        currentUser={effectiveUser}
        calendarEvents={events}
        onSave={async (payload) => {
          const id = payload.id || String(Date.now())
          let roomId = payload.roomId
          if (!roomId && payload.location && roomsFromApi.length) {
            const room = roomsFromApi.find(
              (r) => r.name?.toLowerCase() === payload.location?.toLowerCase()
            )
            if (room) roomId = room.id
          }
          if (getAuthToken()) {
            try {
              await platformPost('/api/events', {
                name: payload.name,
                description: payload.description || undefined,
                date: payload.date,
                startTime: payload.time || '00:00',
                endTime: payload.endTime || undefined,
                roomId: roomId || undefined,
                chairsRequested: payload.chairsRequested,
                tablesRequested: payload.tablesRequested,
                submittedById: effectiveUser?.id || undefined,
              })
            } catch {
              /* persist to local state regardless */
            }
          }
          const newEvent = {
            id,
            name: payload.name,
            description: payload.description,
            date: payload.date,
            location: payload.location,
            owner: payload.owner,
            creator: payload.creator,
            watchers: payload.watchers || [],
            hasTicketSales: payload.hasTicketSales,
            time: payload.time,
            isPaid: payload.isPaid,
            needsSignup: payload.needsSignup,
            facilitiesRequested: payload.facilitiesRequested,
            techRequested: payload.techRequested,
            resources: payload.resources,
            tablesRequested: payload.tablesRequested,
            chairsRequested: payload.chairsRequested,
            repeatEnabled: payload.repeatEnabled,
            repeatRule: payload.repeatRule,
            communications: payload.communications ?? [],
          }
          const createTicket = async (payload) => {
            try {
              const res = await platformPost('/api/tickets', payload)
              if (!res.ok) return null
              return await res.json()
            } catch {
              return null
            }
          }
          const eventWithNotifications = await notifyTeamsForScheduledEvent(newEvent, users, setSupportRequests, createTicket)
          setEvents((prev) => {
            const existing = prev.find((e) => e.id === id)
            if (existing) return prev.map((e) => (e.id === id ? eventWithNotifications : e))
            return [...prev, eventWithNotifications]
          })
          setLiveEvent(eventWithNotifications)
        }}
        onGenerateLandingPage={() => setLandingPageModalOpen(true)}
      />
      )}

      {landingPageModalOpen && (
      <EventLandingPageModal
        isOpen={landingPageModalOpen}
        onClose={() => setLandingPageModalOpen(false)}
        event={liveEvent}
      />
      )}

      {infoModalOpen && (
      <EventInfoModal
        isOpen={infoModalOpen}
        onClose={closeEventInfo}
        event={selectedEvent}
        onEdit={canEdit(effectiveUser) ? handleEventInfoEdit : undefined}
        onDelete={canEdit(effectiveUser) ? handleEventInfoDelete : undefined}
        onCancel={canEdit(effectiveUser) ? handleEventInfoCancel : undefined}
        onEventUpdate={(updated) => {
          setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
          setSelectedEvent(updated)
          if (liveEvent?.id === updated.id) setLiveEvent(updated)
        }}
        currentUser={effectiveUser}
      />
      )}

      {campusMapModalOpen && (
      <CampusMapModal
        isOpen={campusMapModalOpen}
        onClose={() => setCampusMapModalOpen(false)}
      />
      )}

      {facilitiesDrawerOpen && (
      <DrawerModal
        isOpen={facilitiesDrawerOpen}
        onClose={() => setFacilitiesDrawerOpen(false)}
        title="Create Facilities Request"
      >
        <FacilitiesRequestForm
          onSubmit={async (payload) => {
            if (getAuthToken()) {
              try {
                const res = await platformPost('/api/tickets', {
                  title: payload.title,
                  description: payload.details || undefined,
                  type: 'Facilities',
                  category: 'MAINTENANCE',
                  priority: payload.priority || 'normal',
                })
                if (res.ok) {
                  const ticket = await res.json()
                  setSupportRequests((prev) => [...(prev || []), ticket])
                  setFacilitiesDrawerOpen(false)
                  return
                }
              } catch {
                /* fall through to local state */
              }
            }
            setSupportRequests((prev) => [
              ...(prev || []),
              {
                id: Date.now(),
                type: 'Facilities',
                title: payload.title,
                priority: payload.priority,
                time: 'Just now',
                submittedBy: effectiveUser?.name ?? 'Unknown',
                requestedItems: payload.requestedItems,
                status: 'new',
                createdAt: new Date().toISOString(),
                order: 9999,
              },
            ])
            setFacilitiesDrawerOpen(false)
          }}
          inventoryItems={inventoryItems}
          inventoryStock={inventoryStock}
          onInventoryCheck={(requested) =>
            checkItemsAvailable(inventoryItems, inventoryStock, requested)
          }
          inDrawer
        />
      </DrawerModal>
      )}

      {itDrawerOpen && (
      <DrawerModal
        isOpen={itDrawerOpen}
        onClose={() => setITDrawerOpen(false)}
        title="Create IT Request"
      >
        <ITRequestForm
          onSubmit={async (payload) => {
            if (getAuthToken()) {
              try {
                const res = await platformPost('/api/tickets', {
                  title: payload.title,
                  description: payload.details || undefined,
                  type: 'IT',
                  category: 'IT',
                  priority: payload.priority || 'normal',
                })
                if (res.ok) {
                  const ticket = await res.json()
                  setSupportRequests((prev) => [...(prev || []), ticket])
                  setITDrawerOpen(false)
                  return
                }
              } catch {
                /* fall through to local state */
              }
            }
            setSupportRequests((prev) => [
              ...(prev || []),
              {
                id: Date.now(),
                type: 'IT',
                title: payload.title,
                priority: payload.priority,
                time: 'Just now',
                submittedBy: effectiveUser?.name ?? 'Unknown',
                status: 'new',
                createdAt: new Date().toISOString(),
                order: 9999,
              },
            ])
            setITDrawerOpen(false)
          }}
          inDrawer
        />
      </DrawerModal>
      )}

      {formBuilderOpen && (
      <FormBuilderModal
        isOpen={formBuilderOpen}
        onClose={() => {
          setFormBuilderOpen(false)
          setFormToEdit(null)
        }}
        form={formToEdit}
        onSave={(updated) => {
          setForms((prev) =>
            prev.map((f) => (f.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : f))
          )
          if (formToEdit?.id === updated.id) setFormToEdit(updated)
        }}
        canEdit={canEdit(effectiveUser)}
        users={users}
        onPreview={(form) => {
          setFormBuilderOpen(false)
          setFormToEdit(null)
          setFormIdToPreview(form?.id ?? null)
          setFormIdToFill(null)
          setActiveTab('forms')
        }}
      />
      )}

      {commandBarOpen && (
      <CommandBar
        isOpen={commandBarOpen}
        onClose={() => setCommandBarOpen(false)}
        supportRequests={supportRequests}
        onNavigateToTab={(tab) => setActiveTab(tab)}
      />
      )}

      {aiFormModalOpen && (
      <AIFormModal
        isOpen={aiFormModalOpen}
        onClose={() => setAIFormModalOpen(false)}
        users={users}
        onFormCreated={(newForm) => {
          newForm.createdBy = effectiveUser?.name ?? ''
          setForms((prev) => [...prev, newForm])
          setFormToEdit(newForm)
          setFormBuilderOpen(true)
          setAIFormModalOpen(false)
        }}
      />
      )}

      {searchParams.get('onboarding') === '1' && (
        <OnboardingModal
          user={effectiveUser}
          orgLogoUrl={orgLogoUrl || searchParams.get('orgLogoUrl')}
          orgName={orgName || searchParams.get('orgName')}
          onComplete={(updatedUser) => {
            const next = new URLSearchParams(searchParams.toString())
            next.delete('onboarding')
            const q = next.toString()
            router.replace(q ? `${pathname || '/app'}?${q}` : (pathname || '/app'))
            if (updatedUser && effectiveUser?.id === currentUser?.id) {
              setCurrentUser((prev) => ({ ...prev, name: updatedUser.name, role: updatedUser.role }))
            }
            refreshOrg()
          }}
        />
      )}
    </div>
  )
}
