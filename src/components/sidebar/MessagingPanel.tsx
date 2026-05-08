'use client'

import { useRouter } from 'next/navigation'
import ChannelList from '@/components/messaging/ChannelList'

interface MessagingPanelProps {
  setIsOpen: (open: boolean) => void
}

export default function MessagingPanel({ setIsOpen }: MessagingPanelProps) {
  const router = useRouter()

  function handleSelectChannel(channelId: string) {
    router.push(`/messaging?channel=${channelId}`)
    setIsOpen(false)
  }

  function handleCompose() {
    router.push('/messaging?compose=true')
    setIsOpen(false)
  }

  function handleBrowseChannels() {
    router.push('/messaging?browse=true')
    setIsOpen(false)
  }

  return (
    <div className="flex flex-col h-full pt-6">
      <ChannelList
        activeChannelId={null}
        onSelectChannel={handleSelectChannel}
        onCompose={handleCompose}
        onBrowseChannels={handleBrowseChannels}
      />
    </div>
  )
}
