import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  CalendarDays,
  Headphones,
  Building2,
  Package,
  FileText,
  UserCircle,
  MapPin,
  Droplets,
  CreditCard,
} from 'lucide-react'

import { PLATFORM_URL } from '../services/platformApi'
import ViewAsDropdown from './ViewAsDropdown'
import { isFacilitiesTeam, isITTeam, isSuperAdmin, canCreate } from '../data/teamsData'

const mainNavItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'events', label: 'Events', icon: CalendarDays },
  { id: 'forms', label: 'Forms', icon: FileText },
  { id: 'inventory', label: 'Inventory', icon: Package },
]

const supportSection = {
  header: 'Support',
  items: [
    { id: 'facilities', label: 'Facilities', icon: Building2 },
    { id: 'it-support', label: 'IT Support', icon: Headphones },
  ],
}

const itSupportSection = {
  header: 'Support',
  items: [
    { id: 'it-support', label: 'Team Tickets', icon: Headphones },
    { id: 'my-tickets', label: 'My Tickets', icon: UserCircle },
  ],
}

const facilitiesSupportSection = {
  header: 'Support',
  items: [
    { id: 'facilities', label: 'Team Tickets', icon: Building2 },
    { id: 'facilities-my-tickets', label: 'My Tickets', icon: UserCircle },
  ],
}

export default function Sidebar({
  activeTab,
  onTabChange,
  users,
  teams,
  currentUser,
  actualUser,
  viewAsUser,
  onViewAs,
  onClearViewAs,
  showInventory = false,
  showCampusMap = true,
  showWaterManagement = false,
}) {
  const isFacilitiesUser = isFacilitiesTeam(currentUser, teams)
  const isITUser = isITTeam(currentUser, teams)
  const superAdmin = isSuperAdmin(currentUser)

  const getNavLabel = (item) => {
    if (superAdmin) return item.label
    if (item.id === 'facilities' && isFacilitiesUser) return 'Team Tickets'
    if (item.id === 'it-support' && isITUser) return 'Team Tickets'
    if (item.id === 'my-tickets' || item.id === 'facilities-my-tickets') return 'My Tickets'
    return item.label
  }

  const supportItems = isITUser ? itSupportSection.items : isFacilitiesUser ? facilitiesSupportSection.items : supportSection.items

  return (
    <aside className="sticky top-0 w-56 h-screen max-h-screen flex flex-col overflow-hidden border-r border-zinc-200 dark:border-zinc-800 dark:border-blue-950/50 bg-zinc-50/80 dark:bg-zinc-900/90 backdrop-blur-xl shrink-0">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 dark:border-blue-950/40 shrink-0 flex items-center justify-center min-h-[52px]">
        <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight text-center">
          Lionheart Operations
        </h1>
      </div>

      <nav className="flex-1 min-h-0 p-3 flex flex-col overflow-hidden">
        <div className="space-y-0.5 flex-shrink-0">
          {/* Main links */}
          {mainNavItems.map((item) => {
            if (item.id === 'inventory' && !showInventory) return null
            if (item.id === 'forms' && !canCreate(currentUser)) return null
            const Icon = item.icon
            const isActive = activeTab === item.id
            const label = getNavLabel(item)
            return (
              <motion.button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm font-medium transition-colors ${isActive ? 'bg-blue-500/15 text-blue-400' : 'text-zinc-500 dark:text-zinc-400 hover:bg-blue-500/10 dark:hover:bg-blue-500/10'}`}
                whileTap={{ scale: 0.98 }}
              >
                <Icon className="w-4 h-4 shrink-0" strokeWidth={2} />
                <span className="dark:text-zinc-300">{label}</span>
              </motion.button>
            )
          })}

          {/* Add-ons: Water Management */}
          {showWaterManagement && (
            <div className="pt-3 mt-1">
              <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Add-ons
              </p>
              <button
                type="button"
                onClick={() => onTabChange('water-management')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm font-medium transition-colors mt-0.5 ${
                  activeTab === 'water-management' ? 'bg-blue-500/15 text-blue-400' : 'text-zinc-500 dark:text-zinc-400 hover:bg-blue-500/10 dark:hover:bg-blue-500/10'
                }`}
              >
                <Droplets className="w-4 h-4 shrink-0" strokeWidth={2} />
                <span className="dark:text-zinc-300">Water Management</span>
              </button>
            </div>
          )}

          {/* Support section header + links */}
          <div className="pt-3 mt-1">
            <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              {supportSection.header}
            </p>
            <div className="pl-1 pt-0.5 space-y-0.5">
              {supportItems.map((item) => {
                const Icon = item.icon
                const isActive = activeTab === item.id
                const label = getNavLabel(item)
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onTabChange(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm font-medium transition-colors ${isActive ? 'bg-blue-500/15 text-blue-400' : 'text-zinc-500 dark:text-zinc-400 hover:bg-blue-500/10 dark:hover:bg-blue-500/10'}`}
                  >
                    <Icon className="w-4 h-4 shrink-0" strokeWidth={2} />
                    <span className="dark:text-zinc-300">{label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </nav>

      <div className="p-3 pt-0 border-t border-zinc-200 dark:border-zinc-800 dark:border-blue-950/40 shrink-0 mt-auto space-y-1">
        {showCampusMap && (
          <a
            href={`${PLATFORM_URL}/campus`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
          >
            <MapPin className="w-4 h-4 shrink-0" strokeWidth={2} />
            <span>Campus Map</span>
            <span className="text-[10px] ml-auto">↗</span>
          </a>
        )}
        {superAdmin && (
          <button
            type="button"
            onClick={() => onTabChange('billing')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'billing' ? 'bg-primary-600 text-white' : 'text-primary-600 dark:text-primary-400 hover:bg-primary-500/15 font-semibold'
            }`}
          >
            <CreditCard className="w-4 h-4 shrink-0" strokeWidth={2} />
            <span>Manage Subscription</span>
          </button>
        )}
        <ViewAsDropdown
          users={users ?? []}
          teams={teams ?? []}
          actualUser={actualUser ?? currentUser}
          viewAsUser={viewAsUser}
          currentUser={currentUser}
          onViewAs={onViewAs}
          onClearViewAs={onClearViewAs}
          className="w-full"
        />
      </div>
    </aside>
  )
}