'use client'

import { useRouter } from 'next/navigation'
import {
  User,
  School,
  Shield,
  Users,
  UserCog,
  Building2,
  Puzzle,
  Link2,
  ScrollText,
  CreditCard,
  CalendarDays,
  ClipboardCheck,
  KeyRound,
} from 'lucide-react'
import BottomSheet from '@/components/ui/BottomSheet'
import { AppEventName, emitAppEvent } from '@/lib/events/app-bus'

interface SettingsSheetProps {
  open: boolean
  onClose: () => void
  canManageWorkspace: boolean
}

interface NavItem {
  icon: React.ReactNode
  label: string
  tab: string
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const GENERAL_ITEMS: NavItem[] = [
  { icon: <User className="w-5 h-5" />, label: 'My Profile', tab: 'profile' },
]

const WORKSPACE_GROUPS: NavGroup[] = [
  {
    label: 'Organization',
    items: [
      { icon: <School className="w-5 h-5" />, label: 'Organization', tab: 'school-info' },
      { icon: <Building2 className="w-5 h-5" />, label: 'Facilities', tab: 'campus' },
    ],
  },
  {
    label: 'People',
    items: [
      { icon: <UserCog className="w-5 h-5" />, label: 'Members', tab: 'users' },
      { icon: <Users className="w-5 h-5" />, label: 'Teams', tab: 'teams' },
      { icon: <Shield className="w-5 h-5" />, label: 'Roles', tab: 'roles' },
    ],
  },
  {
    label: 'Billing & Apps',
    items: [
      { icon: <CreditCard className="w-5 h-5" />, label: 'Billing', tab: 'billing' },
      { icon: <Puzzle className="w-5 h-5" />, label: 'Add-ons', tab: 'add-ons' },
      { icon: <Link2 className="w-5 h-5" />, label: 'Integrations', tab: 'integrations' },
    ],
  },
  {
    label: 'Security',
    items: [
      { icon: <KeyRound className="w-5 h-5" />, label: 'Single Sign-On', tab: 'sso' },
      { icon: <ScrollText className="w-5 h-5" />, label: 'Activity Log', tab: 'activity-log' },
    ],
  },
]

export default function SettingsSheet({
  open,
  onClose,
  canManageWorkspace,
}: SettingsSheetProps) {
  const router = useRouter()

  const navigate = (tab: string) => {
    onClose()
    // Dispatch event to change settings tab (matches existing sidebar pattern)
    emitAppEvent(AppEventName.SETTINGS_TAB_CHANGE, { tab })
    router.push('/settings')
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Settings" maxHeight={0.9}>
      <div className="px-4 py-3 space-y-5">
        {/* General */}
        <section>
          <p className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase px-2 mb-2">
            General
          </p>
          <div className="space-y-0.5">
            {GENERAL_ITEMS.map((item) => (
              <button
                key={item.tab}
                onClick={() => navigate(item.tab)}
                className="w-full flex items-center gap-3 px-3 py-3 min-h-[48px] rounded-xl hover:bg-slate-100/80 active:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <span className="flex-shrink-0 text-slate-400">{item.icon}</span>
                <span className="text-sm font-medium text-slate-700">{item.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Workspace — grouped */}
        {canManageWorkspace &&
          WORKSPACE_GROUPS.map((group) => (
            <section key={group.label}>
              <p className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase px-2 mb-2">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <button
                    key={item.tab}
                    onClick={() => navigate(item.tab)}
                    className="w-full flex items-center gap-3 px-3 py-3 min-h-[48px] rounded-xl hover:bg-slate-100/80 active:bg-slate-200/60 transition-colors cursor-pointer"
                  >
                    <span className="flex-shrink-0 text-slate-400">{item.icon}</span>
                    <span className="text-sm font-medium text-slate-700">{item.label}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
      </div>
    </BottomSheet>
  )
}
