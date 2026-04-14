'use client'

import { useRouter } from 'next/navigation'
import {
  Home,
  Calendar,
  ScrollText,
} from 'lucide-react'
import ActionSheet from '@/components/ui/ActionSheet'

interface EventsSheetProps {
  open: boolean
  onClose: () => void
}

export default function EventsSheet({ open, onClose }: EventsSheetProps) {
  const router = useRouter()

  const items = [
    {
      icon: <Home className="w-5 h-5" />,
      label: 'Events Hub',
      description: 'Browse and manage events',
      onClick: () => router.push('/events'),
    },
    {
      icon: <Calendar className="w-5 h-5" />,
      label: 'Calendar',
      description: 'Calendar view of all events',
      onClick: () => router.push('/calendar'),
    },
    {
      icon: <ScrollText className="w-5 h-5" />,
      label: 'Year Plans',
      description: 'Planning and submissions',
      onClick: () => router.push('/planning'),
    },
  ]

  return (
    <ActionSheet
      open={open}
      onClose={onClose}
      title="Events"
      items={items}
    />
  )
}
