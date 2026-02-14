import { useState, useEffect } from 'react'
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
import PendingApprovalsWidget from './components/PendingApprovalsWidget'
import ITDashboardRequests from './components/ITDashboardRequests'
import FacilitiesDashboardRequests from './components/FacilitiesDashboardRequests'
import PondHealthWidget from './components/PondHealthWidget'
import AVEventNotifications from './components/AVEventNotifications'
import TopBar from './components/TopBar'
import CommandBar from './components/CommandBar'
import EventInfoModal from './components/EventInfoModal'
import SettingsPage from './components/SettingsPage'
import { INITIAL_EVENTS, userStartedEventWithTicketSales } from './data/eventsData'
import { fetchIcalEvents } from './services/icalService'
import { INITIAL_SUPPORT_REQUESTS } from './data/supportTicketsData'
import {
  INITIAL_INVENTORY_ITEMS,
  INITIAL_INVENTORY_STOCK,
  checkItemsAvailable,
  getItemsByScope,
  getStockByScope,
} from './data/inventoryData'
import { DEFAULT_TEAMS, INITIAL_USERS, canCreate, canEdit, isFacilitiesTeam, isITTeam, isAVTeam, getUserTeamIds } from './data/teamsData'

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
  events: { title: 'Events', showAll: false },
  forms: { title: 'Forms', showAll: false },
  'it-support': { title: 'IT Support', showAll: false },
  'my-tickets': { title: 'My Tickets', showAll: false },
  inventory: { title: 'Inventory', showAll: false },
  settings: { title: 'Settings', showAll: false },
}

export default function App() {
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
  const [currentUser, setCurrentUser] = useState(INITIAL_USERS[0]) // actual logged-in user
  const [viewAsUser, setViewAsUser] = useState(null) // when set, we're "viewing as" this user
  const effectiveUser = viewAsUser ?? currentUser
  const [supportRequests, setSupportRequests] = useState(INITIAL_SUPPORT_REQUESTS)
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

  // Dark mode by default
  useEffect(() => {
    document.documentElement.classList.add('dark')
  }, [])

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

  // Load real events from iCal feed (SchoolDude)
  useEffect(() => {
    let cancelled = false
    fetchIcalEvents().then((icalEvents) => {
      if (cancelled || !icalEvents.length) return
      setEvents(icalEvents)
    })
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
  const showInventory = hasTeamInventory || inventoryPrefs[effectiveUser?.id] === true
  const inventoryScope = isAVUser ? 'av' : isFacilitiesUser ? 'facilities' : isITUser ? 'it' : (inventoryPrefs[effectiveUser?.id] ? 'personal' : null)

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

  return (
    <div className="min-h-screen flex bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
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
      />

      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <TopBar
          currentUser={effectiveUser}
          formSubmissions={formSubmissions}
          forms={forms}
          onNavigateToSettings={() => setActiveTab('settings')}
          onNavigateToFormResponses={(formId) => {
            setFormIdToViewResponses(formId)
            setActiveTab('forms')
          }}
          onOpenCommandBar={() => setCommandBarOpen(true)}
        />
        <div className="flex-1 flex min-h-0 overflow-hidden gap-6 lg:gap-8">
        <div className="flex-1 min-w-0 overflow-auto flex flex-col min-h-0">
          <div
            className={`min-h-full flex flex-col min-h-0 w-full ${activeTab !== 'settings' ? 'p-6 lg:p-8' : ''}`}
          >
          {activeTab === 'settings' ? (
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
                  onCreateEvent={canCreate(effectiveUser) ? () => setEventModalOpen(true) : undefined}
                  onCreateSmartEvent={canCreate(effectiveUser) ? () => setSmartEventModalOpen(true) : undefined}
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
                        currentUser={effectiveUser}
                        users={users}
                        teams={teams}
                        onNavigateToSupport={() => setActiveTab('it-support')}
                      />
                    </section>
                  )}
                  {isFacilitiesTeam(effectiveUser, teams) && (
                    <>
                      <section>
                        <PondHealthWidget
                          setSupportRequests={setSupportRequests}
                          currentUser={effectiveUser}
                        />
                      </section>
                      <section>
                        <FacilitiesDashboardRequests
                          requests={supportRequests}
                          setSupportRequests={setSupportRequests}
                          currentUser={effectiveUser}
                          onNavigateToSupport={() => setActiveTab('facilities')}
                        />
                      </section>
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
                  <DashboardTodoWidget key={effectiveUser?.id} currentUser={effectiveUser} />
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
                {activeTab === 'events' && canCreate(effectiveUser) && (
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
                <InventoryPage
                  items={inventoryItems}
                  setItems={setInventoryItems}
                  stock={inventoryStock}
                  setStock={setInventoryStock}
                  inventoryScope={inventoryScope}
                />
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

      <EventCreatorModal
        isOpen={eventModalOpen}
        onClose={() => {
          setEventModalOpen(false)
          setEditingEvent(null)
        }}
        onEventUpdate={handleEventUpdate}
        initialEvent={editingEvent}
        onSave={(payload) => {
          const id = payload.id || String(Date.now())
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
        onSave={(payload) => {
          const id = payload.id || String(Date.now())
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

      <DrawerModal
        isOpen={facilitiesDrawerOpen}
        onClose={() => setFacilitiesDrawerOpen(false)}
        title="Create Facilities Request"
      >
        <FacilitiesRequestForm
          onSubmit={(payload) => {
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
          onSubmit={(payload) => {
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
    </div>
  )
}
