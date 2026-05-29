'use client'

import { useState, useCallback, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  CalendarDays,
  MessageSquare,
  Wrench,
  Monitor,
  ClipboardCheck,
  TicketCheck,
  Menu,
  Trophy,
} from 'lucide-react'
import { haptic } from '@/lib/haptics'
import { useMessagingUnread } from '@/lib/hooks/useMessagingUnread'
import ProfileSheet from './ProfileSheet'
import SettingsSheet from './SettingsSheet'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MobileTabBarProps {
  // Role/team flags
  isOnMaintenanceTeam: boolean
  isOnITTeam: boolean
  isSuperAdmin: boolean
  canManageMaintenance: boolean
  canClaimMaintenance: boolean
  canSubmitMaintenance: boolean
  canManageIT: boolean
  canSubmitIT: boolean
  canManageWorkspace: boolean
  athleticsEnabled: boolean
  canWriteAthletics: boolean
  // User info
  userName: string
  userEmail: string
  userAvatar?: string
  onLogout?: () => void
}

type SheetAction = 'profile' | 'settings' | 'more'

interface TabItem {
  id: string
  icon: typeof LayoutDashboard
  label: string
  href: string
  badge?: number
  activeRoutes?: string[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MobileTabBar({
  isOnMaintenanceTeam,
  isOnITTeam,
  isSuperAdmin,
  canManageMaintenance,
  canClaimMaintenance,
  canManageIT,
  canSubmitIT,
  canManageWorkspace,
  athleticsEnabled,
  canWriteAthletics,
  userName,
  userEmail,
  userAvatar,
  onLogout,
}: MobileTabBarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [openSheet, setOpenSheet] = useState<SheetAction | null>(null)
  const unreadMessages = useMessagingUnread()

  // Build tab list: Dashboard, Calendar, Messages (always) + role-based tab
  const tabs = useMemo(() => {
    const list: TabItem[] = [
      {
        id: 'dashboard',
        icon: LayoutDashboard,
        label: 'Dashboard',
        href: '/dashboard',
        activeRoutes: ['/dashboard'],
      },
      {
        id: 'calendar',
        icon: CalendarDays,
        label: 'Calendar',
        href: '/calendar',
        activeRoutes: ['/calendar'],
      },
      {
        id: 'messages',
        icon: MessageSquare,
        label: 'Messages',
        href: '/messaging',
        badge: unreadMessages,
        activeRoutes: ['/messaging'],
      },
    ]

    // Role-based tab: pick the most relevant one based on team membership
    if (isSuperAdmin || canManageWorkspace) {
      // Admins and super-admins get Approvals
      list.push({
        id: 'approvals',
        icon: ClipboardCheck,
        label: 'Approvals',
        href: '/approvals',
        activeRoutes: ['/approvals'],
      })
    } else if (isOnITTeam) {
      // IT team gets IT Tickets queue
      list.push({
        id: 'it-tickets',
        icon: Monitor,
        label: 'IT Tickets',
        href: '/it',
        activeRoutes: ['/it'],
      })
    } else if (isOnMaintenanceTeam) {
      // Maintenance team gets Work Orders
      list.push({
        id: 'work-orders',
        icon: Wrench,
        label: 'Work Orders',
        href: '/maintenance',
        activeRoutes: ['/maintenance'],
      })
    } else if (athleticsEnabled && canWriteAthletics) {
      list.push({
        id: 'athletics',
        icon: Trophy,
        label: 'Athletics',
        href: '/athletics',
        activeRoutes: ['/athletics'],
      })
    } else {
      // Everyone else (teachers, staff) gets Tickets (submit + my tickets)
      list.push({
        id: 'tickets',
        icon: TicketCheck,
        label: 'Tickets',
        href: '/tickets',
        activeRoutes: ['/tickets', '/maintenance', '/it'],
      })
    }

    // More tab (overflow — profile, settings)
    list.push({
      id: 'more',
      icon: Menu,
      label: 'More',
      href: '',
      activeRoutes: ['/settings'],
    })

    return list
  }, [
    unreadMessages,
    isSuperAdmin,
    canManageWorkspace,
    isOnITTeam,
    isOnMaintenanceTeam,
    athleticsEnabled,
    canWriteAthletics,
  ])

  const isActive = useCallback(
    (tab: TabItem): boolean => {
      if (tab.id === 'dashboard') return pathname === '/dashboard' || pathname === '/'
      if (tab.activeRoutes) {
        return tab.activeRoutes.some((r) => pathname.startsWith(r))
      }
      return false
    },
    [pathname],
  )

  const handleTabPress = (tab: TabItem) => {
    haptic('light')
    if (tab.id === 'more') {
      setOpenSheet('more')
    } else {
      router.push(tab.href)
    }
  }

  return (
    <>
      {/* Tab Bar */}
      <nav
        className="mobile-tab-bar lg:hidden fixed bottom-0 inset-x-0 z-mobilenav px-3"
        style={{ paddingBottom: 'var(--safe-area-bottom)' }}
        role="navigation"
        aria-label="Main navigation"
      >
        <div
          className="relative mx-auto flex h-16 max-w-[440px] items-center justify-around rounded-t-[28px] border border-black/[0.06] bg-white/95 pl-1 backdrop-blur-xl"
          style={{
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon
            const active = isActive(tab)

            return (
              <button
                key={tab.id}
                onClick={() => handleTabPress(tab)}
                className="relative flex h-full min-h-[56px] min-w-[44px] flex-1 cursor-pointer items-center justify-center rounded-2xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
                aria-label={tab.label}
                aria-current={active ? 'page' : undefined}
              >
                {active && (
                  <motion.div
                    layoutId="mobile-tab-active-square"
                    className="absolute left-[calc(50%-22px)] top-[calc(50%-22px)] z-0 h-11 w-11 rounded-xl bg-slate-950"
                    transition={{ type: 'spring', stiffness: 520, damping: 36, mass: 0.75 }}
                  />
                )}
                <div className="relative z-10">
                  <Icon
                    className={`h-[23px] w-[23px] transition-colors duration-200 ${
                      active ? 'text-white' : 'text-slate-900'
                    }`}
                    strokeWidth={active ? 2.35 : 2}
                    aria-hidden="true"
                  />
                  {tab.badge != null && tab.badge > 0 && (
                    <span className="absolute -right-2 -top-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {tab.badge > 99 ? '99+' : tab.badge}
                    </span>
                  )}
                </div>
                <span className="sr-only">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* More Sheet — profile + settings */}
      <MoreSheet
        open={openSheet === 'more'}
        onClose={() => setOpenSheet(null)}
        userName={userName}
        userEmail={userEmail}
        userAvatar={userAvatar}
        isSuperAdmin={isSuperAdmin}
        canManageWorkspace={canManageWorkspace}
        onLogout={onLogout}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// More Sheet — combines Profile + Settings into a single overflow menu
// ---------------------------------------------------------------------------

function MoreSheet({
  open,
  onClose,
  userName,
  userEmail,
  userAvatar,
  isSuperAdmin,
  canManageWorkspace,
  onLogout,
}: {
  open: boolean
  onClose: () => void
  userName: string
  userEmail: string
  userAvatar?: string
  isSuperAdmin: boolean
  canManageWorkspace: boolean
  onLogout?: () => void
}) {
  const router = useRouter()

  if (!open) return null

  const navigate = (href: string) => {
    haptic('light')
    router.push(href)
    onClose()
  }

  const handleLogout = () => {
    haptic('medium')
    onLogout?.()
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-50 lg:hidden"
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        className="fixed bottom-0 inset-x-0 z-50 lg:hidden bg-white rounded-t-2xl"
        style={{ paddingBottom: 'var(--safe-area-bottom)' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        <div className="px-5 pb-6 space-y-4">
          {/* User info */}
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div
              className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
            >
              {userAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element -- User avatars may come from tenant storage or external identity providers.
                <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-sm font-semibold">
                  {(userName || 'U').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{userName}</p>
              <p className="text-xs text-slate-500 truncate">{userEmail}</p>
            </div>
          </div>

          {/* Navigation items */}
          <div className="space-y-1">
            <MoreItem label="Profile" onClick={() => navigate('/settings?tab=profile')} />
            <MoreItem label="Notifications" onClick={() => navigate('/settings?tab=notifications')} />
            {(isSuperAdmin || canManageWorkspace) && (
              <MoreItem label="Settings" onClick={() => navigate('/settings')} />
            )}
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full py-3 text-sm font-medium text-red-600 rounded-xl hover:bg-red-50 active:bg-red-100 transition-colors cursor-pointer"
          >
            Log Out
          </button>
        </div>
      </motion.div>
    </>
  )
}

function MoreItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-3 text-sm font-medium text-slate-700 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
    >
      {label}
    </button>
  )
}
