'use client'

import type { SettingsTab, SettingsTabDef } from './types'
import { GENERAL_TABS, WORKSPACE_GROUPS } from './constants'

interface SettingsPanelProps {
  activeSettingsTab: SettingsTab
  canManageWorkspace: boolean
  onTabClick: (tab: SettingsTab) => void
}

export default function SettingsPanel({
  activeSettingsTab,
  canManageWorkspace,
  onTabClick,
}: SettingsPanelProps) {
  const renderTabList = (tabs: SettingsTabDef[], label: string) => (
    <nav className="space-y-1" aria-label={`${label} settings sections`}>
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isTabActive = activeSettingsTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onTabClick(tab.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl text-sm transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
              isTabActive
                ? 'text-slate-900 font-semibold bg-[rgb(236,241,252)]'
                : 'text-slate-600 hover:bg-white/30 hover:text-slate-900'
            }`}
          >
            <Icon className={`w-5 h-5 flex-shrink-0 ${isTabActive ? 'text-primary-500' : ''}`} />
            {tab.label}
          </button>
        )
      })}
    </nav>
  )

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-10 pb-4 border-b border-white/30">
        <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Settings</h2>
      </div>

      <div className="px-3 pt-4">
        <p className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase px-2 mb-2">
          General
        </p>
        {renderTabList(GENERAL_TABS, 'General')}
      </div>

      {canManageWorkspace && (
        <div className="px-3 pt-3 pb-4 space-y-4">
          {WORKSPACE_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase px-2 mb-2">
                {group.label}
              </p>
              {renderTabList(group.tabs, group.label)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
