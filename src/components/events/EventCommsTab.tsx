'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Megaphone, ClipboardList, Bell } from 'lucide-react'
import { tabContent } from '@/lib/animations'
import { useAnnouncements } from '@/lib/hooks/useEventComms'
import { useSurveys } from '@/lib/hooks/useEventComms'
import { useNotificationRules } from '@/lib/hooks/useNotificationRules'
import { AnnouncementComposer } from './comms/AnnouncementComposer'
import { AnnouncementFeed } from './comms/AnnouncementFeed'
import { SurveyManager } from './comms/SurveyManager'
import { NotificationTimeline } from './comms/NotificationTimeline'
import { NotificationRuleDrawer } from './comms/NotificationRuleDrawer'
import type { NotificationRuleRow } from '@/lib/types/notification-orchestration'

// ─── Types ─────────────────────────────────────────────────────────────────────

type CommsSubTab = 'announcements' | 'surveys' | 'notifications'

interface EventCommsTabProps {
  eventProjectId: string
  eventTitle?: string
  eventStartDate?: Date | null
}

// ─── Sub-tab bar ──────────────────────────────────────────────────────────────

interface SubTabBarProps {
  activeTab: CommsSubTab
  onChange: (tab: CommsSubTab) => void
  announcementCount: number
  activeSurveyCount: number
  notificationCount: number
}

function SubTabBar({ activeTab, onChange, announcementCount, activeSurveyCount, notificationCount }: SubTabBarProps) {
  const tabs: Array<{ id: CommsSubTab; label: string; count: number; icon: typeof Megaphone }> = [
    { id: 'announcements', label: 'Announcements', count: announcementCount, icon: Megaphone },
    { id: 'surveys', label: 'Surveys', count: activeSurveyCount, icon: ClipboardList },
    { id: 'notifications', label: 'Notifications', count: notificationCount, icon: Bell },
  ]

  return (
    <div className="flex bg-slate-100 rounded-full p-1 w-fit">
      {tabs.map(({ id, label, count, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer ${
            activeTab === id
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Icon className={`w-4 h-4 ${activeTab === id ? 'text-white' : ''}`} />
          {label}
          {count > 0 && (
            <span
              className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                activeTab === id
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-200 text-slate-600'
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

export function EventCommsTab({ eventProjectId, eventTitle = 'Event', eventStartDate }: EventCommsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<CommsSubTab>('announcements')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<NotificationRuleRow | undefined>(undefined)

  const { data: announcements = [] } = useAnnouncements(eventProjectId)
  const { data: surveys = [] } = useSurveys(eventProjectId)
  const { data: notificationRules = [] } = useNotificationRules(eventProjectId)

  const activeSurveyCount = surveys.filter(s => s.status === 'ACTIVE').length
  const notificationCount = notificationRules.length

  // Use eventStartDate prop or fall back to 30 days from now
  const resolvedEventDate = eventStartDate ?? (() => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d
  })()

  function openAddDrawer() {
    setEditingRule(undefined)
    setDrawerOpen(true)
  }

  function openEditDrawer(rule: NotificationRuleRow) {
    setEditingRule(rule)
    setDrawerOpen(true)
  }

  function closeDrawer() {
    setDrawerOpen(false)
    setEditingRule(undefined)
  }

  return (
    <div className="space-y-6">
      {/* Quick stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-blue-50/80 to-indigo-50/80 border border-blue-100 rounded-xl p-4">
          <p className="text-2xl font-bold text-slate-900">{announcements.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Announcement{announcements.length !== 1 ? 's' : ''} sent</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-50/80 to-teal-50/80 border border-emerald-100 rounded-xl p-4">
          <p className="text-2xl font-bold text-slate-900">{activeSurveyCount}</p>
          <p className="text-xs text-slate-500 mt-0.5">Active survey{activeSurveyCount !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-gradient-to-br from-violet-50/80 to-purple-50/80 border border-violet-100 rounded-xl p-4">
          <p className="text-2xl font-bold text-slate-900">{notificationCount}</p>
          <p className="text-xs text-slate-500 mt-0.5">Notification rule{notificationCount !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Sub-tab navigation */}
      <SubTabBar
        activeTab={activeSubTab}
        onChange={setActiveSubTab}
        announcementCount={announcements.length}
        activeSurveyCount={activeSurveyCount}
        notificationCount={notificationCount}
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
          {activeSubTab === 'announcements' && (
            <div className="space-y-6">
              {/* Composer card */}
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-indigo-500" />
                  Compose Announcement
                </h3>
                <AnnouncementComposer eventProjectId={eventProjectId} />
              </div>

              {/* Feed card */}
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">
                  Sent Announcements
                </h3>
                <AnnouncementFeed eventProjectId={eventProjectId} />
              </div>
            </div>
          )}

          {activeSubTab === 'surveys' && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-1 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-indigo-500" />
                Surveys
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Post-event feedback surveys that use your registration form as the question template.
              </p>
              <SurveyManager eventProjectId={eventProjectId} />
            </div>
          )}

          {activeSubTab === 'notifications' && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-1 flex items-center gap-2">
                <Bell className="w-4 h-4 text-indigo-500" />
                Automated Notifications
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Set up notification triggers with AI-drafted messages. All notifications require approval before sending.
              </p>
              <NotificationTimeline
                eventProjectId={eventProjectId}
                eventTitle={eventTitle}
                eventStartDate={resolvedEventDate}
                onAddRule={openAddDrawer}
                onEditRule={openEditDrawer}
              />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Notification rule drawer */}
      {drawerOpen && (
        <NotificationRuleDrawer
          eventProjectId={eventProjectId}
          rule={editingRule}
          eventTitle={eventTitle}
          eventDate={resolvedEventDate}
          onClose={closeDrawer}
        />
      )}
    </div>
  )
}
