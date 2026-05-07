'use client'

import { useState, useCallback } from 'react'
import { MessageSquare } from 'lucide-react'
import ChannelList from './ChannelList'
import MessageArea from './MessageArea'

export default function MessagingShell() {
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null)

  // Thread click handler — no-op for now, Plan 04 wires the thread panel
  const handleThreadClick = useCallback((_messageId: string) => {
    // Will be implemented in Plan 04 (thread panel)
  }, [])

  return (
    <div className="ui-glass flex h-[calc(100vh-64px)] rounded-xl overflow-hidden">
      {/* Channel list sidebar */}
      <div className="w-[280px] flex-shrink-0 border-r border-slate-200/60 overflow-y-auto">
        <ChannelList
          activeChannelId={activeChannelId}
          onSelectChannel={setActiveChannelId}
        />
      </div>

      {/* Message area */}
      <div className="flex-1 flex flex-col">
        {activeChannelId ? (
          <MessageArea
            channelId={activeChannelId}
            onThreadClick={handleThreadClick}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
            <MessageSquare className="w-10 h-10" />
            <p className="text-sm">Select a channel to start messaging</p>
          </div>
        )}
      </div>
    </div>
  )
}
