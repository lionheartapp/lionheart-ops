'use client'

import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import ChannelList from './ChannelList'

export default function MessagingShell() {
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null)

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
      <div className="flex-1 flex items-center justify-center">
        {activeChannelId ? (
          <div
            data-channel-id={activeChannelId}
            className="flex-1 h-full flex items-center justify-center text-slate-400"
          >
            <p className="text-sm">Messages will appear here</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <MessageSquare className="w-10 h-10" />
            <p className="text-sm">Select a channel to start messaging</p>
          </div>
        )}
      </div>
    </div>
  )
}
