'use client'

import { useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Settings2,
  CalendarDays,
  BarChart3,
} from 'lucide-react'
import ActionSheet from '@/components/ui/ActionSheet'
import { AppEventName, emitAppEvent } from '@/lib/events/app-bus'

interface AthleticsSheetProps {
  open: boolean
  onClose: () => void
}

export default function AthleticsSheet({ open, onClose }: AthleticsSheetProps) {
  const router = useRouter()

  const items = [
    {
      icon: <LayoutDashboard className="w-5 h-5" />,
      label: 'Today',
      description: 'What needs attention',
      onClick: () => {
        emitAppEvent(AppEventName.ATHLETICS_TAB_CHANGE, { tab: 'overview' })
        router.push('/athletics')
      },
    },
    {
      icon: <Settings2 className="w-5 h-5" />,
      label: 'Teams',
      description: 'Sports, teams, and rosters',
      onClick: () => {
        emitAppEvent(AppEventName.ATHLETICS_TAB_CHANGE, { tab: 'manage' })
        router.push('/athletics')
      },
    },
    {
      icon: <CalendarDays className="w-5 h-5" />,
      label: 'Schedule',
      description: 'Games and practices',
      onClick: () => {
        emitAppEvent(AppEventName.ATHLETICS_TAB_CHANGE, { tab: 'schedule' })
        router.push('/athletics')
      },
    },
    {
      icon: <BarChart3 className="w-5 h-5" />,
      label: 'Results',
      description: 'Scores, standings, and stats',
      onClick: () => {
        emitAppEvent(AppEventName.ATHLETICS_TAB_CHANGE, { tab: 'stats' })
        router.push('/athletics')
      },
    },
  ]

  return (
    <ActionSheet
      open={open}
      onClose={onClose}
      title="Athletics"
      items={items}
    />
  )
}
