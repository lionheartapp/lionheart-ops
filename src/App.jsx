import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Sidebar from './components/Sidebar'
import CreateDropdown from './components/CreateDropdown'
import EventCreatorModal from './components/EventCreatorModal'
import SmartEventModal from './components/SmartEventModal'
import EventLandingPageModal from './components/EventLandingPageModal'
import EventsPage from './components/EventsPage'
import TicketingTable from './components/TicketingTable'
import SupportQueue from './components/SupportQueue'
import ITSupportPage from './components/ITSupportPage'
import MyTicketsPage from './components/MyTicketsPage'
import FacilitiesPage from './components/FacilitiesPage'
import FacilitiesMyTicketsPage from './components/FacilitiesMyTicketsPage'
import DashboardEventsList from './components/DashboardEventsList'
import DashboardTodoWidget from './components/DashboardTodoWidget'
import OnboardingChecklist from './components/OnboardingChecklist'
import PendingApprovalsWidget from './components/PendingApprovalsWidget'
import ITDashboardRequests from './components/ITDashboardRequests'
import FacilitiesDashboardRequests from './components/FacilitiesDashboardRequests'
import WaterOpsWidget from './components/WaterOpsWidget'
import WidgetErrorBoundary from './components/WidgetErrorBoundary'
import AVEventNotifications from './components/AVEventNotifications'
import TopBar from './components/TopBar'
import CommandBar from './components/CommandBar'
import EventInfoModal from './components/EventInfoModal'
import CampusMapModal from './components/CampusMapModal'
import SettingsPage from './components/SettingsPage'
import WaterManagementPage from './components/WaterManagementPage'
import OnboardingModal from './components/OnboardingModal'
import { INITIAL_EVENTS, userStartedEventWithTicketSales } from './data/eventsData'
import {
  INITIAL_INVENTORY_ITEMS,
  INITIAL_INVENTORY_STOCK,
  checkItemsAvailable,
  getItemsByScope,
  getStockByScope,
} from './data/inventoryData'
import { DEFAULT_TEAMS, INITIAL_USERS, canCreate, canCreateEvent, canEdit, isFacilitiesTeam, isITTeam, isAVTeam, isSuperAdmin, getUserTeamIds, EVENT_SCHEDULING_MESSAGE } from './data/teamsData'
import { useOrgModules } from './context/OrgModulesContext'
import { getAuthToken, platformFetch, platformPost } from './services/platformApi'

const INVENTORY_PREFS_KEY = 'schoolops-inventory-prefs'

function loadInventoryPrefs() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(INVENTORY_PREFS_KEY) : null
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}
import InventoryPage from './components/InventoryPage'
import FormsPage from './components/FormsPage'
import FormBuilderModal from './components/FormBuilderModal'
import AIFormModal from './components/AIFormModal'
import DrawerModal from './components/DrawerModal'
import FacilitiesRequestForm from './components/FacilitiesRequestForm'
import ITRequestForm from './components/ITRequestForm'
import { INITIAL_FORMS, INITIAL_SUBMISSIONS, createForm } from './data/formsData'
import { notifyTeamsForScheduledEvent } from './data/eventNotifications'

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

export default function App() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
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
  const [inventoryPrefs, setInventoryPrefs] = useState(loadInventoryPrefs)
  const [commandBarOpen, setCommandBarOpen] = useState(false)
  const [campusMapModalOpen, setCampusMapModalOpen] = useState(false)

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

  // Fetch inventory from Platform when logged in
  useEffect(() => {
    if (!getAuthToken()) return
    let cancelled = false
    platformFetch('/api/inventory')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          if (Array.isArray(data.items)) setInventoryItems(data.items)
          if (Array.isArray(data.stock)) setInventoryStock(data.stock)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Fetch tickets from Platform when logged in
  useEffect(() => {
    if (!getAuthToken()) return
    let cancelled = false
    platformFetch('/api/tickets')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setSupportRequests(data)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Fetch forms from Platform when logged in
  useEffect(() => {
    if (!getAuthToken()) return
    let cancelled = false
    platformFetch('/api/forms')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setForms(data)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Fetch form submissions from Platform when logged in
  useEffect(() => {
    if (!getAuthToken()) return
    let cancelled = false
    platformFetch('/api/forms/submissions')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setFormSubmissions(data)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Fetch current user from Platform when logged in (use real name instead of "Admin User")
  useEffect(() => {
    if (!getAuthToken()) return
    let cancelled = false
    platformFetch('/api/user/me')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (cancelled || !d?.user) return
        const u = d.user
        const me = {
          id: u.id,
          name: u.name ?? u.email?.split('@')[0] ?? 'User',
          email: u.email ?? '',
          teamIds: u.teamIds ?? [],
          role: u.role ?? 'super-admin',
        }
        setCurrentUser(me)
        setUsers((prev) => {
          const idx = prev.findIndex((p) => p.id === me.id)
          if (idx >= 0) return prev.map((p, i) => (i === idx ? { ...p, ...me } : p))
          const placeholderIdx = prev.findIndex((p) => p.id === 'u0')
          if (placeholderIdx >= 0) {
            return prev.map((p, i) => (i === placeholderIdx ? { ...me, positionTitle: p.positionTitle } : p))
          }
          return [me, ...prev]
        })
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Fetch full member list for Admin/Super Admin (View As dropdown + Members page)
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

  // Fetch events from Platform when logged in (new orgs get empty list)
  useEffect(() => {
    if (!getAuthToken()) return
    let cancelled = false
    platformFetch('/api/events')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return
        if (Array.isArray(data)) {
          setEvents(data.map((e) => ({
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
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

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
  const hasTeamInventory = isAVUser || isFacilitiesUser || isITUser
  const isSA = effectiveUser?.role === 'super-admin' || effectiveUser?.role === 'SUPER_ADMIN'
  const showInventory = hasAdvancedInventory && (hasTeamInventory || isSA || (inventoryPrefs[effectiveUser?.id] === true))
  // Water Management: Maintenance team OR Super Admin only (hide from A/V, IT, Teachers, etc.)
  const showWaterManagementForUser = hasWaterManagement && (isFacilitiesUser || isSuperAdmin(effectiveUser))

  useEffect(() => {
    if (activeTab === 'water-management' && !showWaterManagementForUser) {
      setActiveTab('dashboard')
    }
  }, [activeTab, showWaterManagementForUser])

  const defaultInventoryScope = isAVUser ? 'av' : isFacilitiesUser ? 'facilities' : isITUser ? 'it' : (inventoryPrefs[effectiveUser?.id] ? 'personal' : null)
  const [inventoryScopeOverride, setInventoryScopeOverride] = useState(null)
  const effectiveScope = defaultInventoryScope ?? (isSA ? 'av' : null)
  const inventoryScope = (isSA && inventoryScopeOverride) ? inventoryScopeOverride : effectiveScope

  const setInventoryPref = (userId, enabled) => {
    setInventoryPrefs((prev) => {
      const next = { ...prev, [userId]: enabled }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(INVENTORY_PREFS_KEY, JSON.stringify(next))
      }
      return next
    })
  }
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
          {activeTab === 'water-management' ? (
            <div className="flex-1 flex min-h-0 w-full min-w-0 p-6 lg:p-8">
              <WaterManagementPage
                supportRequests={supportRequests}
                setSupportRequests={setSupportRequests}
                currentUser={effectiveUser}
              />
            </div>
          ) : activeTab === 'settings' ? (
            <div className="flex-1 flex min-h-0 w-full min-w-0">
              <SettingsPage
                settingsSection={settingsSection}
                onSettingsSectionChange={setSettingsSection}
                currentUser={effectiveUser}
                teams={teams}
                setTeams={setTeams}
                users={users}
                setUsers={setUsers}
                hasTeamInventory={hasTeamInventory}
                showInventoryPref={inventoryPrefs[effectiveUser?.id] === true}
                onInventoryPrefChange={(enabled) => setInventoryPref(effectiveUser?.id, enabled)}
                orgLogoUrl={orgLogoUrl || searchParams.get('orgLogoUrl')}
                orgName={orgName || searchParams.get('orgName')}
                orgWebsite={orgWebsite || searchParams.get('orgWebsite')}
                orgAddress={orgAddress || searchParams.get('orgAddress')}
                orgLatitude={orgLatitude}
                orgLongitude={orgLongitude}
                orgLoading={orgLoading}
                onOrgBrandingUpdated={refreshOrg}
                allowTeacherEventRequests={allowTeacherEventRequests}
                onAllowTeacherEventRequestsChange={refreshOrg}
                hasWaterManagement={hasWaterManagement}
                onOpenAddOn={(tab) => setActiveTab(tab)}
              />
            </div>
          ) : activeTab === 'dashboard' && showAll ? (
            <>
              <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  {pageTitle}
                </h1>
                <CreateDropdown
                  mode="dashboard"
                  onCreateEvent={canCreateEvent(effectiveUser, allowTeacherEventRequests) ? () => setEventModalOpen(true) : undefined}
                  onCreateSmartEvent={canCreateEvent(effectiveUser, allowTeacherEventRequests) ? () => setSmartEventModalOpen(true) : undefined}
                  onFormsRequest={
                    canEdit(effectiveUser)
                      ? () => {
                          const newForm = createForm(effectiveUser?.name)
                          setForms((prev) => [...prev, newForm])
                          setFormToEdit(newForm)
                          setFormBuilderOpen(true)
                        }
                      : undefined
                  }
                  onFormsAIRequest={canEdit(effectiveUser) ? () => setAIFormModalOpen(true) : undefined}
                  onFacilitiesRequest={() => setFacilitiesDrawerOpen(true)}
                  onITRequest={() => setITDrawerOpen(true)}
                />
              </header>
              <div className="flex-1 flex min-h-0 gap-6 lg:gap-8 pt-6">
                <div className="flex-1 min-w-0 overflow-auto space-y-8">
                  {(isSuperAdmin(effectiveUser) || (effectiveUser?.role && String(effectiveUser.role).toLowerCase() === 'admin')) && (
                    <OnboardingChecklist
                      onOpenMap={() => setCampusMapModalOpen(true)}
                      onCreateEvent={canCreateEvent(effectiveUser, allowTeacherEventRequests) ? () => setEventModalOpen(true) : () => setActiveTab('events')}
                      onNavigateToMembers={() => { setActiveTab('settings'); setSettingsSection('members') }}
                      isEventCreated={events.length > 0}
                      isTeamSetup={(users?.length ?? 0) > 1}
                      hasVisualCampus={hasVisualCampus}
                    />
                  )}
                  {!isITTeam(effectiveUser, teams) && !isFacilitiesTeam(effectiveUser, teams) && (
                    <section>
                      <DashboardEventsList
                        events={events}
                        currentUser={effectiveUser?.name}
                        onEventClick={openEventInfo}
                      />
                    </section>
                  )}
                  {userStartedEventWithTicketSales(events, effectiveUser?.name) && (
                    <section>
                      <TicketingTable />
                    </section>
                  )}
                  {isITTeam(effectiveUser, teams) && (
                    <section>
                      <ITDashboardRequests
                        requests={supportRequests}
                        setSupportRequests={setSupportRequests}
                        updateTicket={updateTicket}
                        currentUser={effectiveUser}
                        users={users}
                        teams={teams}
                        onNavigateToSupport={() => setActiveTab('it-support')}
                      />
                    </section>
                  )}
                  {(isFacilitiesTeam(effectiveUser, teams) || isSuperAdmin(effectiveUser)) && showWaterManagementForUser && (
                    <>
                      <section>
                        <WidgetErrorBoundary>
                          <WaterOpsWidget
                            setSupportRequests={setSupportRequests}
                            currentUser={effectiveUser}
                          />
                        </WidgetErrorBoundary>
                      </section>
                      {isFacilitiesTeam(effectiveUser, teams) && (
                        <section>
                          <FacilitiesDashboardRequests
                            requests={supportRequests}
                            setSupportRequests={setSupportRequests}
                            updateTicket={updateTicket}
                            currentUser={effectiveUser}
                            onNavigateToSupport={() => setActiveTab('facilities')}
                          />
                        </section>
                      )}
                    </>
                  )}
                  {isAVTeam(effectiveUser, teams) && (
                    <section>
                      <AVEventNotifications
                        requests={supportRequests}
                        currentUser={effectiveUser}
                        onNavigateToEvents={() => setActiveTab('events')}
                      />
                    </section>
                  )}
                  <PendingApprovalsWidget
                      formSubmissions={formSubmissions}
                      forms={forms}
                      currentUser={effectiveUser}
                      onNavigateToFormResponses={(formId) => {
                        setFormIdToViewResponses(formId)
                        setActiveTab('forms')
                      }}
                  />
                  <section>
                    <SupportQueue
                      type="all"
                      requests={supportRequests}
                      currentUser={effectiveUser}
                      viewMode="my-tickets"
                      title="My support requests"
                      emptyMessage="You haven't submitted any requests yet."
                    />
                  </section>
                </div>
                <div className="shrink-0 pl-2">
                  <DashboardTodoWidget
                    key={effectiveUser?.id}
                    currentUser={effectiveUser}
                    users={users}
                    events={events}
                    orgLogoUrl={orgLogoUrl}
                    onNavigateToTab={setActiveTab}
                    onNavigateToSettings={(section) => {
                      setActiveTab('settings')
                      setSettingsSection(section)
                    }}
                  />
                </div>
              </div>
            </>
          ) : (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col flex-1 min-h-0 gap-6"
          >
              <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  {pageTitle}
                </h1>
                {activeTab === 'events' && canCreateEvent(effectiveUser, allowTeacherEventRequests) && (
                  <CreateDropdown
                    mode="events"
                    onCreateEvent={() => setEventModalOpen(true)}
                    onCreateSmartEvent={() => setSmartEventModalOpen(true)}
                  />
                )}
                {activeTab === 'forms' && canEdit(effectiveUser) && (
                  <CreateDropdown
                    mode="forms"
                    onFormsRequest={() => {
                      const newForm = createForm(effectiveUser?.name)
                      setForms((prev) => [...prev, newForm])
                      setFormToEdit(newForm)
                      setFormBuilderOpen(true)
                    }}
                    onFormsAIRequest={() => setAIFormModalOpen(true)}
                  />
                )}
              </header>

              {/* Events: Linfield message when user cannot create events */}
              {activeTab === 'events' && !canCreateEvent(effectiveUser, allowTeacherEventRequests) && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg px-4 py-2 border border-zinc-200 dark:border-zinc-700">
                  {EVENT_SCHEDULING_MESSAGE}
                </p>
              )}
              {/* Events: calendar, My Events, Generate Landing Page */}
              {activeTab === 'events' && (
                <EventsPage
                  events={events}
                  setEvents={setEvents}
                  currentUser={effectiveUser}
                  currentUserTeamIds={getUserTeamIds(effectiveUser)}
                  onCreateEvent={() => setEventModalOpen(true)}
                  onCreateSmartEvent={() => setSmartEventModalOpen(true)}
                  onGenerateLandingPage={() => setLandingPageModalOpen(true)}
                  onOpenEventInfo={openEventInfo}
                  onEditEvent={handleEventInfoEdit}
                  liveEvent={liveEvent}
                />
              )}

              {showAll && (
                <>
                  {userStartedEventWithTicketSales(events, effectiveUser?.name) && (
                    <section>
                      <TicketingTable />
                    </section>
                  )}
                  <section>
                    <SupportQueue
                      type="all"
                      requests={supportRequests}
                      currentUser={effectiveUser}
                      viewMode="my-tickets"
                      title="My support requests"
                      emptyMessage="You haven’t submitted any requests yet."
                    />
                  </section>
                </>
              )}

              {activeTab === 'it-support' && (
                <ITSupportPage
                  supportRequests={supportRequests}
                  setSupportRequests={setSupportRequests}
                  currentUser={effectiveUser}
                  teams={teams}
                  itDrawerOpen={itDrawerOpen}
                  setITDrawerOpen={setITDrawerOpen}
                  mode="team"
                />
              )}

              {activeTab === 'my-tickets' && (
                <MyTicketsPage
                  supportRequests={supportRequests}
                  currentUser={effectiveUser}
                  itDrawerOpen={itDrawerOpen}
                  setITDrawerOpen={setITDrawerOpen}
                />
              )}

              {activeTab === 'facilities' && (
                <FacilitiesPage
                  supportRequests={supportRequests}
                  setSupportRequests={setSupportRequests}
                  currentUser={effectiveUser}
                  teams={teams}
                  inventoryItems={getItemsByScope(inventoryItems, 'facilities')}
                  inventoryStock={getStockByScope(inventoryStock, inventoryItems, 'facilities')}
                  onInventoryCheck={(requested) =>
                    checkItemsAvailable(
                      getItemsByScope(inventoryItems, 'facilities'),
                      getStockByScope(inventoryStock, inventoryItems, 'facilities'),
                      requested
                    )
                  }
                  facilitiesDrawerOpen={facilitiesDrawerOpen}
                  setFacilitiesDrawerOpen={setFacilitiesDrawerOpen}
                  mode={isFacilitiesUser ? 'team' : 'default'}
                />
              )}

              {activeTab === 'facilities-my-tickets' && (
                <FacilitiesMyTicketsPage
                  supportRequests={supportRequests}
                  currentUser={effectiveUser}
                  facilitiesDrawerOpen={facilitiesDrawerOpen}
                  setFacilitiesDrawerOpen={setFacilitiesDrawerOpen}
                />
              )}

              {activeTab === 'inventory' && inventoryScope && (
                <>
                  {isSA && (
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">View inventory:</span>
                      <select
                        value={inventoryScope}
                        onChange={(e) => setInventoryScopeOverride(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="av">A/V</option>
                        <option value="facilities">Facilities</option>
                        <option value="it">IT</option>
                      </select>
                    </div>
                  )}
                  <InventoryPage
                    items={inventoryItems}
                    setItems={setInventoryItems}
                    stock={inventoryStock}
                    setStock={setInventoryStock}
                    inventoryScope={inventoryScope}
                  />
                </>
              )}

              {activeTab === 'forms' && (
                <FormsPage
                  forms={forms}
                  setForms={setForms}
                  formSubmissions={formSubmissions}
                  setFormSubmissions={setFormSubmissions}
                  currentUser={effectiveUser}
                  users={users}
                  canEdit={canEdit(effectiveUser)}
                  formIdToFill={formIdToFill}
                  onClearFormIdToFill={() => setFormIdToFill(null)}
                  formIdToPreview={formIdToPreview}
                  onClearFormIdToPreview={() => setFormIdToPreview(null)}
                  formIdToViewResponses={formIdToViewResponses}
                  onClearFormIdToViewResponses={() => setFormIdToViewResponses(null)}
                  onEventCreated={(event) => {
                    setEvents((prev) => [...prev, event])
                  }}
                  onCreateForm={
                    canEdit(effectiveUser)
                      ? () => {
                          const newForm = createForm(effectiveUser?.name)
                          setForms((prev) => [...prev, newForm])
                          setFormToEdit(newForm)
                          setFormBuilderOpen(true)
                        }
                      : undefined
                  }
                />
              )}
          </motion.div>
          )}
          </div>
        </div>
        </div>
      </main>
      </div>

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
          const eventWithNotifications = notifyTeamsForScheduledEvent(newEvent, users, setSupportRequests)
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

      <SmartEventModal
        isOpen={smartEventModalOpen}
        onClose={() => setSmartEventModalOpen(false)}
        currentUser={effectiveUser}
        calendarEvents={events}
        onSave={async (payload) => {
          const id = payload.id || String(Date.now())
          if (getAuthToken()) {
            try {
              await platformPost('/api/events', {
                name: payload.name,
                description: payload.description || undefined,
                date: payload.date,
                startTime: payload.time || '00:00',
                endTime: payload.endTime || undefined,
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
          const eventWithNotifications = notifyTeamsForScheduledEvent(newEvent, users, setSupportRequests)
          setEvents((prev) => {
            const existing = prev.find((e) => e.id === id)
            if (existing) return prev.map((e) => (e.id === id ? eventWithNotifications : e))
            return [...prev, eventWithNotifications]
          })
          setLiveEvent(eventWithNotifications)
        }}
        onGenerateLandingPage={() => setLandingPageModalOpen(true)}
      />

      <EventLandingPageModal
        isOpen={landingPageModalOpen}
        onClose={() => setLandingPageModalOpen(false)}
        event={liveEvent}
      />

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

      <CampusMapModal
        isOpen={campusMapModalOpen}
        onClose={() => setCampusMapModalOpen(false)}
      />

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

      <CommandBar
        isOpen={commandBarOpen}
        onClose={() => setCommandBarOpen(false)}
        supportRequests={supportRequests}
        onNavigateToTab={(tab) => setActiveTab(tab)}
      />

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

      {searchParams.get('onboarding') === '1' && (
        <OnboardingModal
          user={effectiveUser}
          orgLogoUrl={orgLogoUrl || searchParams.get('orgLogoUrl')}
          orgName={orgName || searchParams.get('orgName')}
          onComplete={(updatedUser) => {
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              next.delete('onboarding')
              return next
            })
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
