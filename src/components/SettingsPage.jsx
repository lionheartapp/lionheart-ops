import { useState } from 'react'
import {
  Wrench,
  User,
  Bell,
  Globe,
  Users,
  Package,
  LayoutGrid,
  Sun,
  Moon,
} from 'lucide-react'
import MembersPage from './MembersPage'
import { isAVTeam, isFacilitiesTeam, isITTeam } from '../data/teamsData'
import { useTheme } from '../context/ThemeContext'

const generalSettings = [
  { id: 'apps', label: 'Apps', icon: LayoutGrid },
  { id: 'account', label: 'Account', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Sun },
  { id: 'notification', label: 'Notification', icon: Bell },
  { id: 'language', label: 'Language & Region', icon: Globe },
]

const workspaceSettings = [
  { id: 'general', label: 'General', icon: Wrench },
  { id: 'members', label: 'Members', icon: Users },
]

const APP_MODULES = [
  {
    id: 'inventory',
    label: 'Inventory',
    description: 'Track items and stock by location. Team members (A/V, IT, Facilities) see their team inventory; others can enable a personal inventory.',
    icon: Package,
  },
]

function AppsSection({ currentUser, teams, hasTeamInventory, showInventoryPref, onInventoryPrefChange }) {
  const getTeamLabel = () => {
    if (isAVTeam(currentUser, teams)) return 'A/V'
    if (isFacilitiesTeam(currentUser, teams)) return 'Facilities'
    if (isITTeam(currentUser, teams)) return 'IT'
    return null
  }
  const teamLabel = getTeamLabel()

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Apps</h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Enable or disable modules to customize your sidebar. Team apps (e.g. Inventory for A/V, IT, Facilities) are always available to their teams.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {APP_MODULES.map((module) => {
          const Icon = module.icon
          const isTeamModule = module.id === 'inventory' && hasTeamInventory
          const canToggle = module.id === 'inventory' && !hasTeamInventory

          return (
            <div
              key={module.id}
              className="flex items-start gap-4 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 dark:border-blue-950/30 bg-white dark:bg-zinc-800/50"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{module.label}</h3>
                  {canToggle ? (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={showInventoryPref}
                      onClick={() => onInventoryPrefChange?.(!showInventoryPref)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        showInventoryPref ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-600'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                          showInventoryPref ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  ) : isTeamModule ? (
                    <span className="text-xs px-2 py-1 rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-400 font-medium">
                      Enabled ({teamLabel} Team)
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Off</span>
                  )}
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{module.description}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AppearanceSection() {
  const { theme, setTheme, isDark } = useTheme()
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Appearance</h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Choose how Lionheart looks for you. Light mode is the default; dark mode reduces eye strain in low light.
      </p>
      <div className="flex items-center gap-4 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 dark:border-blue-950/30 bg-white dark:bg-zinc-800/50">
        <div className="flex-1">
          <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Dark mode</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Use a dark theme for the dashboard and app
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isDark}
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 ${
            isDark ? 'bg-primary-600' : 'bg-zinc-300 dark:bg-zinc-600'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
              isDark ? 'translate-x-5' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
      <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
        {isDark ? (
          <Moon className="w-4 h-4 text-primary-600" />
        ) : (
          <Sun className="w-4 h-4 text-primary-600" />
        )}
        <span>
          {isDark ? 'Dark mode is on' : 'Light mode is on'}
        </span>
      </div>
    </div>
  )
}

function AccountSection({ currentUser }) {
  const nameParts = (currentUser?.name ?? '').split(' ')
  const [firstName, setFirstName] = useState(nameParts[0] ?? '')
  const [lastName, setLastName] = useState(nameParts.slice(1).join(' ') ?? '')
  const [positionTitle, setPositionTitle] = useState(currentUser?.positionTitle ?? '')

  return (
    <div>
      <section>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-6">My Profile</h2>
        <div className="flex flex-col sm:flex-row sm:items-start gap-6">
          <div className="w-24 h-24 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center shrink-0">
            <span className="text-3xl font-semibold text-zinc-600 dark:text-zinc-400">
              {(currentUser?.name ?? '?').charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0 space-y-4">
            <div className="flex flex-wrap gap-2 mb-2">
              <button
                type="button"
                className="px-4 py-2.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100"
              >
                + Change Image
              </button>
              <button
                type="button"
                className="px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Remove Image
              </button>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              We support PNGs, JPEGs and GIFs under 2MB
            </p>
            <div className="space-y-4 mt-6 max-w-sm">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                  placeholder="First name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                  placeholder="Last name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Position Title</label>
                <input
                  type="text"
                  value={positionTitle}
                  onChange={(e) => setPositionTitle(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                  placeholder="e.g. Athletic Director, Teacher"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function SettingsSectionContent({
  section,
  currentUser,
  teams,
  setTeams,
  users,
  setUsers,
  hasTeamInventory,
  showInventoryPref,
  onInventoryPrefChange,
}) {
  if (section === 'members') {
    return (
      <MembersPage
        teams={teams}
        setTeams={setTeams}
        users={users}
        setUsers={setUsers}
        currentUser={currentUser}
      />
    )
  }

  const labels = {
    apps: 'Apps',
    account: 'Account',
    appearance: 'Appearance',
    notification: 'Notification',
    language: 'Language & Region',
    general: 'General',
    members: 'Members',
  }

  const content = {
    account: <AccountSection currentUser={currentUser} />,
    appearance: <AppearanceSection />,
    apps: (
      <AppsSection
        currentUser={currentUser}
        teams={teams}
        hasTeamInventory={hasTeamInventory}
        showInventoryPref={showInventoryPref}
        onInventoryPrefChange={onInventoryPrefChange}
      />
    ),
  }

  if (section === 'account') return content.account
  if (section === 'apps') return content.apps
  if (section === 'appearance') return content.appearance

  return (
    <div className="space-y-8">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        {labels[section] ?? section}
      </h2>
      {content[section] ?? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {labels[section]} settings coming soon.
        </p>
      )}
    </div>
  )
}

export default function SettingsPage({
  settingsSection,
  onSettingsSectionChange,
  currentUser,
  teams,
  setTeams,
  users,
  setUsers,
  hasTeamInventory = false,
  showInventoryPref = false,
  onInventoryPrefChange,
}) {
  const allSections = [...generalSettings, ...workspaceSettings]
  const activeSection = allSections.some((s) => s.id === settingsSection)
    ? settingsSection
    : 'apps'

  return (
    <div className="flex-1 flex min-h-0 gap-0">
      {/* Secondary settings nav */}
      <nav className="w-52 shrink-0 flex flex-col border-r border-zinc-200 dark:border-zinc-800 dark:border-blue-950/40 bg-zinc-50/50 dark:bg-zinc-900/50 py-4">
        <div className="px-3 space-y-6">
          <div>
            <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              General Settings
            </p>
            <div className="mt-1 space-y-0.5">
              {generalSettings.map((item) => {
                const Icon = item.icon
                const isActive = activeSection === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSettingsSectionChange(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-500/20 text-blue-600 dark:text-blue-300'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/80'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" strokeWidth={2} />
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Workspace Settings
            </p>
            <div className="mt-1 space-y-0.5">
              {workspaceSettings.map((item) => {
                const Icon = item.icon
                const isActive = activeSection === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSettingsSectionChange(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-500/20 text-blue-600 dark:text-blue-300'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/80'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" strokeWidth={2} />
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <div className="flex-1 min-w-0 overflow-auto p-6 lg:p-8">
        <SettingsSectionContent
          section={activeSection}
          currentUser={currentUser}
          teams={teams}
          setTeams={setTeams}
          users={users}
          setUsers={setUsers}
          hasTeamInventory={hasTeamInventory}
          showInventoryPref={showInventoryPref}
          onInventoryPrefChange={onInventoryPrefChange}
        />
      </div>
    </div>
  )
}
