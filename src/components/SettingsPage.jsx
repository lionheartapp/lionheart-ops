import { useState } from 'react'
import {
  Wrench,
  User,
  Bell,
  Globe,
  Users,
  Package,
  LayoutGrid,
  CreditCard,
  Check,
  AlertTriangle,
} from 'lucide-react'
import MembersPage from './MembersPage'
import { isAVTeam, isFacilitiesTeam, isITTeam } from '../data/teamsData'

// --- CONSTANTS ---
const PRICING_PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    priceMonthly: 199,
    priceAnnual: 159,
    description: 'Small private schools',
    features: ['Maintenance & IT Tickets', 'Basic Calendar', 'Basic User Management'],
    buttonLabel: 'Downgrade'
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 499,
    priceAnnual: 399,
    description: 'Standard K-12 schools',
    features: ['Water Management Module', 'Inventory Tracking', 'Smart Event AI (Unlimited)', 'Visual Repair Assistant (50 uses/mo)'],
    isPopular: true,
    buttonLabel: 'Current Plan'
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthly: null,
    priceAnnual: null,
    description: 'Multi-site / Districts',
    features: ['Visual Campus (3D Matterport)', 'Monthly AI Budget Reports', 'Unlimited AI Usage', 'Dedicated Support Manager'],
    buttonLabel: 'Contact Sales'
  }
]

// --- SUB-COMPONENTS ---

function SubscriptionSection() {
  const [billingCycle, setBillingCycle] = useState('monthly')
  const currentPlanId = 'pro'
  const isTrial = true
  const daysLeft = 14

  return (
    <div className="space-y-8 max-w-5xl">
      {/* 1. Trial Notice Banner */}
      {isTrial && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-800/50 flex items-center justify-center shrink-0">
               <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
             </div>
             <div>
               <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                 Your Pro Trial is active
               </h3>
               <p className="text-sm text-zinc-500 dark:text-zinc-400">
                 You have <span className="font-medium text-amber-600 dark:text-amber-400">{daysLeft} days</span> left to explore all features.
               </p>
             </div>
          </div>
          <button className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm whitespace-nowrap">
            Add Payment Method
          </button>
        </div>
      )}

      {/* 2. Header & Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
           <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Plans & Pricing</h2>
           <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
             Choose the plan that fits your school&apos;s needs.
           </p>
        </div>

        <div className="flex items-center p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg self-start">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
              billingCycle === 'monthly'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('annual')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5 ${
              billingCycle === 'annual'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            Annual <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full">-20%</span>
          </button>
        </div>
      </div>

      {/* 3. Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PRICING_PLANS.map((plan) => {
          const isActive = plan.id === currentPlanId
          const price = billingCycle === 'monthly' ? plan.priceMonthly : plan.priceAnnual
          const yearlySavings = plan.priceMonthly && plan.priceAnnual
            ? (plan.priceMonthly * 12) - (plan.priceAnnual * 12)
            : 0

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col p-6 rounded-2xl border transition-all ${
                isActive
                  ? 'border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/10 dark:bg-emerald-900/10'
                  : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/40 hover:border-zinc-300 dark:hover:border-zinc-600'
              }`}
            >
              {plan.isPopular && !isActive && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm">
                  Best Value
                </div>
              )}
              {isActive && isTrial && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm">
                  Active Trial
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{plan.name}</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 h-10">{plan.description}</p>
              </div>

              <div className="mb-6">
                {price !== null ? (
                   <div>
                     <div className="flex items-baseline gap-1">
                       <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">${price}</span>
                       <span className="text-sm text-zinc-500">/mo</span>
                     </div>
                     {billingCycle === 'annual' && yearlySavings > 0 && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium bg-emerald-100 dark:bg-emerald-900/30 inline-block px-2 py-0.5 rounded">
                          Save ${yearlySavings}/year
                        </p>
                     )}
                   </div>
                ) : (
                   <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Custom</div>
                )}
                {billingCycle === 'annual' && price !== null && (
                   <p className="text-xs text-zinc-400 mt-1">
                     Billed ${price * 12} yearly
                   </p>
                )}
              </div>

              <div className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm text-zinc-600 dark:text-zinc-300">
                    <Check className={`w-4 h-4 shrink-0 mt-0.5 ${isActive ? 'text-emerald-500' : 'text-zinc-400'}`} />
                    <span className="leading-snug">{feature}</span>
                  </div>
                ))}
              </div>

              <button
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                    : 'border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700'
                }`}
              >
                {isActive ? (isTrial ? 'Activate Subscription' : 'Current Plan') : plan.buttonLabel}
              </button>
            </div>
          )
        })}
      </div>

      {/* 4. Payment Method (Placeholder for Stripe) */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-8">
        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">Payment Method</h3>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
           <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0">
             <CreditCard className="w-5 h-5 text-zinc-500" />
           </div>
           <div className="flex-1">
             <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">No payment method added</p>
             <p className="text-xs text-zinc-500 dark:text-zinc-400">Add a card to ensure uninterrupted service when your trial ends.</p>
           </div>
           <button className="px-4 py-2 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-sm font-medium rounded-lg hover:bg-white dark:hover:bg-zinc-800 transition-colors">
             + Add Card
           </button>
        </div>
      </div>
    </div>
  )
}

function AppsSection({ currentUser, teams, hasTeamInventory, showInventoryPref, onInventoryPrefChange }) {
  const APP_MODULES = [
    {
      id: 'inventory',
      label: 'Inventory',
      description: 'Track items and stock by location. Team members (A/V, IT, Facilities) see their team inventory; others can enable a personal inventory.',
      icon: Package,
    },
  ]

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
        Enable or disable modules to customize your sidebar.
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
                Change Image
              </button>
              <button
                type="button"
                className="px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Remove
              </button>
            </div>
            <div className="space-y-4 mt-6 max-w-sm">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Position Title</label>
                <input
                  type="text"
                  value={positionTitle}
                  onChange={(e) => setPositionTitle(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                  placeholder="e.g. Athletic Director"
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
        users={users}
        setUsers={setUsers}
        currentUser={currentUser}
      />
    )
  }

  const labels = {
    apps: 'Apps',
    account: 'Account',
    subscription: 'Subscription',
    notification: 'Notification',
    language: 'Language & Region',
    general: 'General',
  }

  const content = {
    account: <AccountSection currentUser={currentUser} />,
    apps: (
      <AppsSection
        currentUser={currentUser}
        teams={teams}
        hasTeamInventory={hasTeamInventory}
        showInventoryPref={showInventoryPref}
        onInventoryPrefChange={onInventoryPrefChange}
      />
    ),
    subscription: <SubscriptionSection />
  }

  if (content[section]) return content[section]

  return (
    <div className="space-y-8">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        {labels[section] ?? section}
      </h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {labels[section]} settings coming soon.
      </p>
    </div>
  )
}

// --- MAIN PAGE COMPONENT ---

const generalSettings = [
  { id: 'apps', label: 'Apps', icon: LayoutGrid },
  { id: 'account', label: 'Account', icon: User },
  { id: 'notification', label: 'Notification', icon: Bell },
  { id: 'language', label: 'Language & Region', icon: Globe },
]

const workspaceSettings = [
  { id: 'general', label: 'General', icon: Wrench },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'subscription', label: 'Subscription', icon: CreditCard },
]

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
      <nav className="w-56 shrink-0 flex flex-col border-r border-zinc-200 dark:border-zinc-800 dark:border-blue-950/40 bg-zinc-50/50 dark:bg-zinc-900/50 py-6">
        <div className="px-3 space-y-8">
          <div>
            <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              General
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
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
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
            <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Workspace
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
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
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
      <div className="flex-1 min-w-0 overflow-auto p-8 lg:p-10">
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
