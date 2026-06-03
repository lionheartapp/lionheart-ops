'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ChevronLeft, Code, FileText, HelpCircle, KeyRound, Laptop, Link2, Pencil, Projector, QrCode, Route, Wifi } from 'lucide-react'
import { fadeInUp, staggerContainer } from '@/lib/animations'
import { useAnimatedTabIndicator } from '@/lib/hooks/useAnimatedTabIndicator'
import { useAiAvailability } from '@/lib/hooks/useAiAvailability'
import { useITPermissions } from '@/lib/hooks/useITPermissions'
import { usePageTitle } from '@/hooks/usePageTitle'
import TabIndicator from '@/components/ui/TabIndicator'

function LazyPanel() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 animate-pulse">
      <div className="h-4 w-40 rounded bg-slate-200" />
      <div className="mt-4 h-24 rounded bg-slate-100" />
    </div>
  )
}

const TicketRoutingTab = dynamic(() => import('@/components/settings/TicketRoutingTab'), {
  loading: () => <LazyPanel />,
})
const ITMagicLinksTab = dynamic(() => import('@/components/it/ITMagicLinksTab'), {
  loading: () => <LazyPanel />,
})
const QrCodeManager = dynamic(() => import('@/components/forms/QrCodeManager'), {
  ssr: false,
  loading: () => <LazyPanel />,
})
const CategoryFormEditor = dynamic(() => import('@/components/settings/CategoryFormEditor'), {
  ssr: false,
  loading: () => <LazyPanel />,
})

type SettingsTab = 'routing' | 'forms' | 'magic-links' | 'qr-codes'

const VALID_TABS: readonly SettingsTab[] = ['routing', 'forms', 'magic-links', 'qr-codes'] as const

const SETTINGS_TABS: { key: SettingsTab; label: string; icon: typeof Route }[] = [
  { key: 'routing', label: 'Routing', icon: Route },
  { key: 'forms', label: 'Forms', icon: FileText },
  { key: 'magic-links', label: 'Magic Links', icon: Link2 },
  { key: 'qr-codes', label: 'QR Codes', icon: QrCode },
]

const IT_CATEGORY_KEYS = [
  { key: 'HARDWARE', label: 'Hardware', icon: Laptop, color: 'text-slate-600', bg: 'bg-slate-50' },
  { key: 'SOFTWARE', label: 'Software', icon: Code, color: 'text-blue-600', bg: 'bg-blue-50' },
  { key: 'ACCOUNT_PASSWORD', label: 'Accounts & Passwords', icon: KeyRound, color: 'text-amber-600', bg: 'bg-amber-50' },
  { key: 'NETWORK', label: 'Network', icon: Wifi, color: 'text-green-600', bg: 'bg-green-50' },
  { key: 'DISPLAY_AV', label: 'Displays & A/V', icon: Projector, color: 'text-purple-600', bg: 'bg-purple-50' },
  { key: 'OTHER', label: 'Other', icon: HelpCircle, color: 'text-slate-500', bg: 'bg-slate-50' },
]

function isSettingsTab(value: string | null): value is SettingsTab {
  return value !== null && (VALID_TABS as readonly string[]).includes(value)
}

function FormsTab({ aiAvailable }: { aiAvailable: boolean }) {
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const editingCat = IT_CATEGORY_KEYS.find((c) => c.key === editingCategory)

  if (editingCat) {
    const Icon = editingCat.icon
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setEditingCategory(null)}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 cursor-pointer transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to all categories
        </button>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className={`w-10 h-10 rounded-xl ${editingCat.bg} flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${editingCat.color}`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{editingCat.label} Form</h3>
              <p className="text-sm text-slate-500">
                Fields shown when submitting a {editingCat.label.toLowerCase()} ticket
              </p>
            </div>
          </div>

          {aiAvailable && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-3 py-2 text-xs text-blue-700 mb-4">
              AI uses these fields to know what to ask during the conversation.
            </div>
          )}

          <CategoryFormEditor
            key={editingCat.key}
            categoryKey={editingCat.key.toLowerCase()}
            categoryLabel={editingCat.label}
            module="IT"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Ticket Forms</h3>
        <p className="text-sm text-slate-500 mt-0.5">
          {aiAvailable
            ? 'Each category has its own intake form. The AI uses these fields to guide the conversation.'
            : 'Each IT category has its own intake form. Click a category to customize what fields appear.'}
        </p>
      </div>

      {aiAvailable && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-sm text-blue-800">
          AI is enabled. Field definitions tell the AI what information to gather during the conversation.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {IT_CATEGORY_KEYS.map((cat) => {
          const Icon = cat.icon
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => setEditingCategory(cat.key)}
              className="group text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer"
            >
              <div className={`w-10 h-10 rounded-xl ${cat.bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${cat.color}`} />
              </div>
              <h4 className="text-sm font-semibold text-slate-900">{cat.label}</h4>
              <p className="text-xs text-slate-400 mt-0.5">Customize intake fields</p>
              <div className="mt-3 flex items-center gap-1 text-xs text-slate-400 group-hover:text-slate-600 transition-colors">
                <Pencil className="w-3 h-3" />
                Edit form
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function ITSettingsContent() {
  usePageTitle('IT Settings')

  const p = useITPermissions()
  const searchParams = useSearchParams()
  const { aiAvailable } = useAiAvailability()
  const [activeTab, setActiveTab] = useState<SettingsTab>('routing')
  const { containerRef: tabContainerRef, setTabRef, indicatorStyle } = useAnimatedTabIndicator(activeTab, [p.loaded])

  useEffect(() => {
    if (!p.loaded) return
    const requested = searchParams.get('tab')
    if (isSettingsTab(requested)) setActiveTab(requested)
  }, [p.loaded, searchParams])

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab)
    const url = tab === 'routing' ? '/it/settings' : `/it/settings?tab=${tab}`
    window.history.replaceState(null, '', url)
  }

  if (!p.loaded) return null

  if (!p.isOnITTeam && !p.canManage) {
    return (
      <div className="max-w-md mx-auto mt-24 text-center">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Access Required</h2>
        <p className="text-sm text-slate-500 leading-relaxed">
          You need IT management access to configure help desk settings.
        </p>
      </div>
    )
  }

  return (
    <div>
      <motion.div
        className="mb-6"
        initial="hidden"
        animate="visible"
        variants={staggerContainer(0.08, 0.05)}
      >
        <motion.h1 variants={fadeInUp} className="text-2xl font-semibold text-slate-900">
          IT Settings
        </motion.h1>
        <motion.p variants={fadeInUp} className="text-sm text-slate-500 mt-1">
          Configure routing, ticket forms, magic links, and QR codes.
        </motion.p>
      </motion.div>

      <div
        ref={tabContainerRef}
        role="tablist"
        aria-label="IT settings tabs"
        className="relative flex gap-1 border-b border-slate-200 mb-6 overflow-x-auto"
      >
        {SETTINGS_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            ref={(el) => setTabRef(key, el)}
            role="tab"
            aria-selected={activeTab === key}
            id={`tab-${key}`}
            aria-controls={`tabpanel-${key}`}
            onClick={() => handleTabChange(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded ${
              activeTab === key ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
        <TabIndicator style={indicatorStyle} />
      </div>

      <div
        role="tabpanel"
        id="tabpanel-routing"
        aria-labelledby="tab-routing"
        className={activeTab === 'routing' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
      >
        {activeTab === 'routing' && <TicketRoutingTab defaultModule="IT" />}
      </div>

      <div
        role="tabpanel"
        id="tabpanel-forms"
        aria-labelledby="tab-forms"
        className={activeTab === 'forms' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
      >
        {activeTab === 'forms' && <FormsTab aiAvailable={aiAvailable} />}
      </div>

      <div
        role="tabpanel"
        id="tabpanel-magic-links"
        aria-labelledby="tab-magic-links"
        className={activeTab === 'magic-links' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
      >
        {activeTab === 'magic-links' && <ITMagicLinksTab />}
      </div>

      <div
        role="tabpanel"
        id="tabpanel-qr-codes"
        aria-labelledby="tab-qr-codes"
        className={activeTab === 'qr-codes' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
      >
        {activeTab === 'qr-codes' && <QrCodeManager />}
      </div>
    </div>
  )
}
