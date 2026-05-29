'use client'

import { useRouter } from 'next/navigation'
import {
  Settings,
  LogOut,
  Eye,
  Bug,
} from 'lucide-react'
import ActionSheet from '@/components/ui/ActionSheet'
import { AppEventName, emitAppEvent } from '@/lib/events/app-bus'
import { OptimizedImage } from '@/components/ui/OptimizedImage'

interface ProfileSheetProps {
  open: boolean
  onClose: () => void
  userName: string
  userEmail: string
  userAvatar?: string
  isSuperAdmin: boolean
  onLogout?: () => void
}

export default function ProfileSheet({
  open,
  onClose,
  userName,
  userEmail,
  userAvatar,
  isSuperAdmin,
  onLogout,
}: ProfileSheetProps) {
  const router = useRouter()

  const items = [
    {
      icon: <Settings className="w-5 h-5" />,
      label: 'Settings',
      description: 'Manage your workspace',
      onClick: () => router.push('/settings'),
    },
    {
      icon: <Bug className="w-5 h-5" />,
      label: 'Report a Bug',
      onClick: () => {
        // Dispatch event to open bug dialog (matches existing Sidebar pattern)
        emitAppEvent(AppEventName.OPEN_BUG_DIALOG)
      },
    },
    ...(isSuperAdmin
      ? [
          {
            icon: <Eye className="w-5 h-5" />,
            label: 'View as User',
            description: 'Impersonate another user',
            onClick: () => {
              emitAppEvent(AppEventName.OPEN_VIEW_AS_DIALOG)
            },
          },
        ]
      : []),
    {
      icon: <LogOut className="w-5 h-5" />,
      label: 'Log Out',
      onClick: () => onLogout?.(),
      destructive: true,
    },
  ]

  const header = (
    <div className="flex items-center gap-3 pb-3 border-b" style={{ borderColor: 'rgba(17, 15, 10, 0.06)' }}>
      {/* Avatar */}
      <div className="flex-shrink-0 w-11 h-11 rounded-full overflow-hidden" style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}>
        {userAvatar ? (
          <OptimizedImage src={userAvatar} alt={userName} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white text-base font-semibold">
            {userName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 truncate">{userName}</p>
        <p className="text-xs text-slate-400 truncate">{userEmail}</p>
      </div>
    </div>
  )

  return (
    <ActionSheet
      open={open}
      onClose={onClose}
      items={items}
      header={header}
    />
  )
}
