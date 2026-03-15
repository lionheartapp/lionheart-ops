'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Megaphone, ClipboardList } from 'lucide-react'
import { tabContent } from '@/lib/animations'
import { useAnnouncements } from '@/lib/hooks/useEventComms'
import { useSurveys } from '@/lib/hooks/useEventComms'
import { AnnouncementComposer } from './comms/AnnouncementComposer'
import { AnnouncementFeed } from './comms/AnnouncementFeed'
import { SurveyManager } from './comms/SurveyManager'

// ─── Types ─────────────────────────────────────────────────────────────────────

type CommsSubTab = 'announcements' | 'surveys'

interface EventCommsTabProps {
  eventProjectId: string
}

// ─── Sub-tab bar ──────────────────────────────────────────────────────────────

interface SubTabBarProps {
  activeTab: CommsSubTab
  onChange: (tab: CommsSubTab) => void
  announcementCount: number
  activeSurveyCount: number
}

function SubTabBar({ activeTab, onChange, announcementCount, activeSurveyCount }: SubTabBarProps) {
  const tabs: Array<{ id: CommsSubTab; label: string; count: number; icon: typeof Megaphone }> = [
    { id: 'announcements', label: 'Announcements', count: announcementCount, icon: Megaphone },
    { id: 'surveys', label: 'Surveys', count: activeSurveyCount, icon: ClipboardList },
  ]

  return (
    <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
      {tabs.map(({ id, label, count, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
            activeTab === id
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Icon className="w-4 h-4" />
          {label}
          {count > 0 && (
            <span
              className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                activeTab === id
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function EventCommsTab({ eventProjectId }: EventCommsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<CommsSubTab>('announcements')

  const { data: announcements = [] } = useAnnouncements(eventProjectId)
  const { data: surveys = [] } = useSurveys(eventProjectId)

  const activeSurveyCount = surveys.filter(s => s.status === 'ACTIVE').length

  return (
    <div className="space-y-6">
      {/* Quick stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-blue-50/80 to-indigo-50/80 border border-blue-100 rounded-xl p-4">
          <p className="text-2xl font-bold text-gray-900">{announcements.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Announcement{announcements.length !== 1 ? 's' : ''} sent</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-50/80 to-teal-50/80 border border-emerald-100 rounded-xl p-4">
          <p className="text-2xl font-bold text-gray-900">{activeSurveyCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Active survey{activeSurveyCount !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Sub-tab navigation */}
      <SubTabBar
        activeTab={activeSubTab}
        onChange={setActiveSubTab}
        announcementCount={announcements.length}
        activeSurveyCount={activeSurveyCount}
      />

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSubTab}
          variants={tabContent}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {activeSubTab === 'announcements' ? (
            <div className="space-y-6">
              {/* Composer card */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-indigo-500" />
                  Compose Announcement
                </h3>
                <AnnouncementComposer eventProjectId={eventProjectId} />
              </div>

              {/* Feed card */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">
                  Sent Announcements
                </h3>
                <AnnouncementFeed eventProjectId={eventProjectId} />
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-indigo-500" />
                Surveys
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                Post-event feedback surveys that use your registration form as the question template.
              </p>
              <SurveyManager eventProjectId={eventProjectId} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
