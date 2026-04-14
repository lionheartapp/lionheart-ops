'use client'

import { useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Settings2,
  CalendarDays,
  BarChart3,
} from 'lucide-react'
import ActionSheet from '@/components/ui/ActionSheet'

interface AthleticsSheetProps {
  open: boolean
  onClose: () => void
}

export default function AthleticsSheet({ open, onClose }: AthleticsSheetProps) {
  const router = useRouter()

  const items = [
    {
      icon: <LayoutDashboard className="w-5 h-5" />,
      label: 'Overview',
      description: 'Athletics dashboard',
      onClick: () => {
        window.dispatchEvent(new CustomEvent('athletics-tab-change', { detail: { tab: 'overview' } }))
        router.push('/athletics')
      },
    },
    {
      icon: <Settings2 className="w-5 h-5" />,
      label: 'Manage',
      description: 'Sports, teams, and rosters',
      onClick: () => {
        window.dispatchEvent(new CustomEvent('athletics-tab-change', { detail: { tab: 'manage' } }))
        router.push('/athletics')
      },
    },
    {
      icon: <CalendarDays className="w-5 h-5" />,
      label: 'Schedule',
      description: 'Games and practices',
      onClick: () => {
        window.dispatchEvent(new CustomEvent('athletics-tab-change', { detail: { tab: 'schedule' } }))
        router.push('/athletics')
      },
    },
    {
      icon: <BarChart3 className="w-5 h-5" />,
      label: 'Stats',
      description: 'Player statistics',
      onClick: () => {
        window.dispatchEvent(new CustomEvent('athletics-tab-change', { detail: { tab: 'stats' } }))
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
