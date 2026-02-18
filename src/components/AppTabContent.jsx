import { memo } from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import CreateDropdown from './CreateDropdown'
import EventsPage from './EventsPage'
import TicketingTable from './TicketingTable'
import SupportQueue from './SupportQueue'
import ITSupportPage from './ITSupportPage'
import MyTicketsPage from './MyTicketsPage'
import FacilitiesPage from './FacilitiesPage'
import FacilitiesMyTicketsPage from './FacilitiesMyTicketsPage'
import DashboardEventsList from './DashboardEventsList'
import DashboardTodoWidget from './DashboardTodoWidget'
import OnboardingChecklist from './OnboardingChecklist'
import PendingApprovalsWidget from './PendingApprovalsWidget'
import ITDashboardRequests from './ITDashboardRequests'
import FacilitiesDashboardRequests from './FacilitiesDashboardRequests'
import WaterOpsWidget from './WaterOpsWidget'
import WidgetErrorBoundary from './WidgetErrorBoundary'
import AVEventNotifications from './AVEventNotifications'
import SettingsPage from './SettingsPage'
import WaterManagementPage from './WaterManagementPage'
import InventoryPage from './InventoryPage'
import FormsPage from './FormsPage'
import { userStartedEventWithTicketSales } from '../data/eventsData'
import { getItemsByScope, getStockByScope, checkItemsAvailable } from '../data/inventoryData'
import { canCreateEvent, canEdit, isFacilitiesTeam, isITTeam, isAVTeam, isSuperAdmin, getUserTeamIds, INVENTORY_TEAM_IDS, getTeamName, EVENT_SCHEDULING_MESSAGE } from '../data/teamsData'
import { createForm } from '../data/formsData'

/** Tab content switch: water-management | settings | dashboard (showAll) | default (events, forms, facilities, etc.) */
function AppTabContentInner({ tabState }) {
  const {
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
    allowTeacherEventRequests,
    isFacilitiesUser,
    isITUser,
    showWaterManagementForUser,
    hasVisualCampus,
    hasTeamInventory,
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
    setTeams,
    setUsers,
    setInventoryItems,
    setInventoryStock,
  } = tabState

  if (activeTab === 'water-management') {
    return (
      <div className="flex-1 flex min-h-0 w-full min-w-0 p-6 lg:p-8">
        <WaterManagementPage
          supportRequests={supportRequests}
          setSupportRequests={setSupportRequests}
          currentUser={effectiveUser}
        />
      </div>
    )
  }

  if (activeTab === 'settings') {
    return (
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
    )
  }

  if (activeTab === 'dashboard' && showAll) {
    return (
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
    )
  }

  return (
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

      {activeTab === 'events' && !canCreateEvent(effectiveUser, allowTeacherEventRequests) && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg px-4 py-2 border border-zinc-200 dark:border-zinc-700">
          {EVENT_SCHEDULING_MESSAGE}
        </p>
      )}
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
              emptyMessage="You haven't submitted any requests yet."
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
          {inventoryLoading ? (
            <div className="flex flex-col items-center justify-center py-24 text-zinc-500 dark:text-zinc-400">
              <Loader2 className="w-10 h-10 animate-spin mb-3" />
              <p className="text-sm">Loading inventory…</p>
            </div>
          ) : (
            <>
              {isSA && (
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">View inventory:</span>
                  <select
                    value={inventoryScope}
                    onChange={(e) => setInventoryScopeOverride(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    {INVENTORY_TEAM_IDS.map((id) => (
                      <option key={id} value={id}>{getTeamName(teams, id)}</option>
                    ))}
                  </select>
                </div>
              )}
              <InventoryPage
                items={inventoryItems}
                setItems={setInventoryItems}
                stock={inventoryStock}
                setStock={setInventoryStock}
                inventoryScope={inventoryScope}
                users={users}
                currentUser={effectiveUser}
              />
            </>
          )}
        </>
      )}

      {activeTab === 'forms' && (
        formsLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-500 dark:text-zinc-400">
            <Loader2 className="w-10 h-10 animate-spin mb-3" />
            <p className="text-sm">Loading forms…</p>
          </div>
        ) : (
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
        )
      )}
    </motion.div>
  )
}

const AppTabContent = memo(AppTabContentInner)
export default AppTabContent
