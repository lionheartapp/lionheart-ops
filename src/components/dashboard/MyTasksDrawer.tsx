'use client'

import { useState } from 'react'
import { CalendarRange, User } from 'lucide-react'
import DetailDrawer from '@/components/DetailDrawer'
import EventTasksContent from './EventTasksContent'
import PersonalTasksContent from './PersonalTasksContent'
import { useMyTasks, usePersonalTasks, type MyTask, type PersonalTask } from '@/lib/hooks/useMyTasks'

type Tab = 'event' | 'personal'

interface MyTasksDrawerProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: Tab
}

export default function MyTasksDrawer({ isOpen, onClose, initialTab = 'event' }: MyTasksDrawerProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)

  const { data: eventTasks, isLoading: eventLoading } = useMyTasks()
  const { data: personalTasks, isLoading: personalLoading } = usePersonalTasks()

  const eventCount = eventTasks?.filter((t) => t.status !== 'DONE').length ?? 0
  const personalCount = personalTasks?.filter((t) => t.status !== 'DONE').length ?? 0

  const tabs: { key: Tab; label: string; icon: typeof CalendarRange; count: number; id: string }[] = [
    { key: 'event', label: 'Event Tasks', icon: CalendarRange, count: eventCount, id: 'tab-event' },
    { key: 'personal', label: 'Personal', icon: User, count: personalCount, id: 'tab-personal' },
  ]

  return (
    <DetailDrawer isOpen={isOpen} onClose={onClose} title="My Tasks" width="lg">
      <div className="flex flex-col h-full -mx-1">
        {/* Tab bar */}
        <div
          className="flex items-center gap-1 px-1 border-b border-slate-200 flex-shrink-0"
          role="tablist"
          aria-label="Task categories"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                id={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${tab.key}`}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors duration-200 cursor-pointer ${
                  isActive ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span
                    className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
                )}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div
          className="flex-1 overflow-hidden"
          id={`panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
        >
          {activeTab === 'event' ? (
            <EventTasksContent tasks={eventTasks} isLoading={eventLoading} />
          ) : (
            <PersonalTasksContent tasks={personalTasks} isLoading={personalLoading} />
          )}
        </div>
      </div>
    </DetailDrawer>
  )
}
