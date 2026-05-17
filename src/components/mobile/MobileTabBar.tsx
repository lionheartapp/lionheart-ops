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
    if (isSuperAdmin) {
      // Super-admins get Approvals
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
    isOnITTeam,
    isOnMaintenanceTeam,
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
        className="mobile-tab-bar lg:hidden fixed bottom-0 inset-x-0 z-mobilenav"
        style={{
          background: 'rgba(253, 252, 249, 0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(17, 15, 10, 0.06)',
          paddingBottom: 'var(--safe-area-bottom)',
        }}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* SVG gradient definition for active tab icons */}
        <svg width="0" height="0" className="absolute" aria-hidden="true">
          <defs>
            <linearGradient id="tab-icon-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#6366F1" />
            </linearGradient>
          </defs>
        </svg>

        <div className="flex items-center justify-around h-14">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const active = isActive(tab)

            return (
              <button
                key={tab.id}
                onClick={() => handleTabPress(tab)}
                className="relative flex flex-col items-center justify-center flex-1 h-full min-w-[44px] min-h-[44px] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 rounded-lg transition-colors"
                aria-label={tab.label}
                aria-current={active ? 'page' : undefined}
              >
                <div className="relative">
                  <Icon
                    className="w-[22px] h-[22px]"
                    style={active ? { stroke: 'url(#tab-icon-gradient)' } : undefined}
                    strokeWidth={active ? 2.2 : 1.8}
                    aria-hidden="true"
                  />
                  {/* Unread badge */}
                  {tab.badge != null && tab.badge > 0 && (
                    <span className="absolute -top-1 -right-2 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold bg-red-500 text-white">
                      {tab.badge > 99 ? '99+' : tab.badge}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] mt-0.5 leading-tight ${
                    active ? 'font-semibold text-primary-600' : 'font-medium text-slate-400'
                  }`}
                >
                  {tab.label}
                </span>
                {/* Active indicator dot */}
                {active && (
                  <motion.div
                    layoutId="mobile-tab-indicator"
                    className="absolute -bottom-0.5 w-1 h-1 rounded-full"
                    style={{ background: 'linear-gradient(90deg, #3B82F6, #6366F1)' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
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
