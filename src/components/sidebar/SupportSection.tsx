'use client'

import { motion } from 'framer-motion'
import PrefetchLink from '@/components/PrefetchLink'
import {
  ChevronDown,
  Wrench,
  Monitor,
  Video,
} from 'lucide-react'
import { useNavIndicator } from '@/lib/hooks/useNavIndicator'

interface SupportSectionProps {
  pathname: string
  pageSearchParams: URLSearchParams
  // Facilities
  facilitiesOpen: boolean
  setFacilitiesOpen: (fn: (prev: boolean) => boolean) => void
  isOnMaintenanceTeam: boolean
  canManageMaintenance: boolean
  canClaimMaintenance: boolean
  canSubmitMaintenance: boolean
  canReadInventory: boolean
  facilitiesGateCount: { count: number } | undefined
  // IT
  itOpen: boolean
  setItOpen: (fn: (prev: boolean) => boolean) => void
  isOnITTeam: boolean
  canManageIT: boolean
  canSubmitIT: boolean
  canSeeITDevices: boolean
  canSeeITLifecycle: boolean
  canSeeITSecurity: boolean
  canSeeITAdmin: boolean
  // AV
  avOpen: boolean
  setAvOpen: (fn: (prev: boolean) => boolean) => void
  isOnAVTeam: boolean
  canManageWorkspace: boolean
  avGateCount: { count: number } | undefined
  // Navigation
  setSettingsOpen: (open: boolean) => void
  setAthleticsOpen: (open: boolean) => void
  setIsOpen: (open: boolean) => void
}

export default function SupportSection({
  pathname,
  pageSearchParams,
  facilitiesOpen,
  setFacilitiesOpen,
  isOnMaintenanceTeam,
  canManageMaintenance,
  canClaimMaintenance,
  canSubmitMaintenance,
  canReadInventory,
  facilitiesGateCount,
  itOpen,
  setItOpen,
  isOnITTeam,
  canManageIT,
  canSubmitIT,
  canSeeITDevices,
  canSeeITLifecycle,
  canSeeITSecurity,
  canSeeITAdmin,
  avOpen,
  setAvOpen,
  isOnAVTeam,
  canManageWorkspace,
  avGateCount,
  setSettingsOpen,
  setAthleticsOpen,
  setIsOpen,
}: SupportSectionProps) {
  const facilityIndicator = useNavIndicator(
    'facility',
    facilitiesOpen,
    'data-facility-active',
    [pathname, pageSearchParams, canManageMaintenance, canClaimMaintenance],
  )

  const itIndicator = useNavIndicator(
    'it',
    itOpen,
    'data-it-active',
    [pathname, pageSearchParams, canManageIT, canSubmitIT],
  )

  const closePanels = () => {
    setSettingsOpen(false)
    setAthleticsOpen(false)
    setIsOpen(false)
  }

  const isMaintenancePath = pathname.startsWith('/maintenance') || (pathname === '/inventory' && pageSearchParams.get('dept') === 'maintenance')
  const isITPath = pathname.startsWith('/it') || (pathname === '/inventory' && pageSearchParams.get('dept') === 'it')

  const showFacilities = isOnMaintenanceTeam || canManageMaintenance || canClaimMaintenance || canSubmitMaintenance
  const showIT = isOnITTeam || canManageIT || canSubmitIT
  const showAV = isOnAVTeam || canManageWorkspace

  if (!showFacilities && !showIT && !showAV) return null

  return (
    <>
      <div className="px-1 mt-4 mb-1">
        <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Operations</span>
      </div>
      <ul className="space-y-1" role="list">
        {/* ── Facilities / Maintenance ── */}
        {showFacilities && (
          <li>
            {(isOnMaintenanceTeam || canManageMaintenance || canClaimMaintenance) ? (
              <>
                <button
                  onClick={() => {
                    setFacilitiesOpen((prev) => {
                      if (!prev) { setItOpen(() => false); setAvOpen(() => false) }
                      return !prev
                    })
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl transition-colors duration-200 border border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
                    facilitiesOpen
                      ? 'text-slate-900 font-semibold bg-[rgb(236,241,252)]'
                      : 'text-slate-600 hover:bg-white/30 hover:text-slate-900'
                  }`}
                  aria-expanded={facilitiesOpen}
                  aria-label={facilitiesOpen ? 'Collapse maintenance' : 'Expand maintenance'}
                >
                  <Wrench className={`w-5 h-5 flex-shrink-0 ${facilitiesOpen ? 'text-primary-500' : 'text-slate-600'}`} aria-hidden="true" />
                  <span className="text-sm">Maintenance</span>
                  {(facilitiesGateCount?.count ?? 0) > 0 && (
                    <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold leading-none ml-auto">
                      {facilitiesGateCount!.count}
                    </span>
                  )}
                  <motion.span
                    className={`${(facilitiesGateCount?.count ?? 0) > 0 ? '' : 'ml-auto'} block`}
                    animate={{ rotate: facilitiesOpen ? 180 : 0 }}
                    transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                  >
                    <ChevronDown className="w-4 h-4 text-slate-400" aria-hidden="true" />
                  </motion.span>
                </button>
                <div
                  ref={facilityIndicator.containerRefCb}
                  className="relative ml-8 mt-1 overflow-hidden"
                  style={{
                    maxHeight: facilitiesOpen ? '700px' : '0px',
                    opacity: facilitiesOpen ? 1 : 0,
                    transition: 'max-height 0.25s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.2s ease',
                  }}
                >
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-full bg-slate-300/40" />
                  <div
                    ref={facilityIndicator.trailRefCb}
                    className="absolute left-0 w-0.5 rounded-full pointer-events-none"
                    style={{ filter: 'blur(1.5px)' }}
                  />
                  <motion.div
                    className="absolute left-0 w-0.5 rounded-full pointer-events-none"
                    style={{
                      top: facilityIndicator.indicatorTop,
                      height: facilityIndicator.indicatorHeight,
                      opacity: facilityIndicator.indicatorOpacity,
                      background: 'linear-gradient(180deg, #3B82F6 0%, #6366F1 100%)',
                      boxShadow: '0 0 8px rgba(59, 130, 246, 0.5), 0 0 16px rgba(99, 102, 241, 0.25)',
                    }}
                  />
                  <div className="space-y-0.5">
                    <PrefetchLink
                      href="/maintenance"
                      data-facility-active={pathname === '/maintenance' ? 'true' : undefined}
                      onClick={closePanels}
                      className={`flex items-center pl-4 pr-3 py-2.5 min-h-[40px] rounded-lg transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
                        pathname === '/maintenance' ? 'text-slate-900 font-medium' : 'text-slate-500 hover:text-slate-800'
                      }`}
                      aria-current={pathname === '/maintenance' ? 'page' : undefined}
                    >
                      <span className="text-sm">Maintenance Hub</span>
                    </PrefetchLink>
                    {(isOnMaintenanceTeam || canManageMaintenance) && (
                      <PrefetchLink
                        href="/maintenance/work-orders"
                        data-facility-active={pathname === '/maintenance/work-orders' ? 'true' : undefined}
                        onClick={closePanels}
                        className={`flex items-center pl-4 pr-3 py-2.5 min-h-[40px] rounded-lg transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
                          pathname === '/maintenance/work-orders' ? 'text-slate-900 font-medium' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <span className="text-sm">Work Orders</span>
                      </PrefetchLink>
                    )}
                    {canReadInventory && (isOnMaintenanceTeam || canManageMaintenance) && (
                      <PrefetchLink
                        href="/inventory?dept=maintenance"
                        data-facility-active={pathname === '/inventory' && pageSearchParams.get('dept') === 'maintenance' ? 'true' : undefined}
                        onClick={closePanels}
                        className={`flex items-center pl-4 pr-3 py-2.5 min-h-[40px] rounded-lg transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
                          pathname === '/inventory' && pageSearchParams.get('dept') === 'maintenance' ? 'text-slate-900 font-medium' : 'text-slate-500 hover:text-slate-800'
                        }`}
                        aria-current={pathname === '/inventory' && pageSearchParams.get('dept') === 'maintenance' ? 'page' : undefined}
                      >
                        <span className="text-sm">Inventory</span>
                      </PrefetchLink>
                    )}
                    {(isOnMaintenanceTeam || canManageMaintenance) && (
                      <PrefetchLink
                        href="/maintenance/assets"
                        data-facility-active={pathname === '/maintenance/assets' ? 'true' : undefined}
                        onClick={closePanels}
                        className={`flex items-center pl-4 pr-3 py-2.5 min-h-[40px] rounded-lg transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
                          pathname === '/maintenance/assets' ? 'text-slate-900 font-medium' : 'text-slate-500 hover:text-slate-800'
                        }`}
                        aria-current={pathname === '/maintenance/assets' ? 'page' : undefined}
                      >
                        <span className="text-sm">Assets</span>
                      </PrefetchLink>
                    )}
                    {(isOnMaintenanceTeam || canManageMaintenance || canClaimMaintenance) && (
                      <PrefetchLink
                        href="/maintenance/knowledge-base"
                        data-facility-active={pathname.startsWith('/maintenance/knowledge-base') ? 'true' : undefined}
                        onClick={closePanels}
                        className={`flex items-center pl-4 pr-3 py-2.5 min-h-[40px] rounded-lg transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
                          pathname.startsWith('/maintenance/knowledge-base') ? 'text-slate-900 font-medium' : 'text-slate-500 hover:text-slate-800'
                        }`}
                        aria-current={pathname.startsWith('/maintenance/knowledge-base') ? 'page' : undefined}
                      >
                        <span className="text-sm">Knowledge Base</span>
                      </PrefetchLink>
                    )}
                    {canManageMaintenance && (
                      <PrefetchLink
                        href="/maintenance/analytics"
                        data-facility-active={pathname.startsWith('/maintenance/analytics') ? 'true' : undefined}
                        onClick={closePanels}
                        className={`flex items-center pl-4 pr-3 py-2.5 min-h-[40px] rounded-lg transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
                          pathname.startsWith('/maintenance/analytics') ? 'text-slate-900 font-medium' : 'text-slate-500 hover:text-slate-800'
                        }`}
                        aria-current={pathname.startsWith('/maintenance/analytics') ? 'page' : undefined}
                      >
                        <span className="text-sm">Analytics</span>
                      </PrefetchLink>
                    )}
                    {canManageMaintenance && (
                      <PrefetchLink
                        href="/maintenance/compliance"
                        data-facility-active={pathname.startsWith('/maintenance/compliance') ? 'true' : undefined}
                        onClick={closePanels}
                        className={`flex items-center pl-4 pr-3 py-2.5 min-h-[40px] rounded-lg transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
                          pathname.startsWith('/maintenance/compliance') ? 'text-slate-900 font-medium' : 'text-slate-500 hover:text-slate-800'
                        }`}
                        aria-current={pathname.startsWith('/maintenance/compliance') ? 'page' : undefined}
                      >
                        <span className="text-sm">Compliance</span>
                      </PrefetchLink>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <PrefetchLink
                href="/maintenance"
                onClick={closePanels}
                className={`flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
                  isMaintenancePath ? 'text-slate-900 font-medium' : 'text-slate-600 hover:text-slate-900 border border-transparent'
                }`}
                style={isMaintenancePath ? { background: 'linear-gradient(135deg, #c8d4e4, #d4dbe8, #ddd8e8)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.5)' } : {}}
                aria-current={isMaintenancePath ? 'page' : undefined}
              >
                <Wrench className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                <span className="text-sm">Facilities</span>
              </PrefetchLink>
            )}
          </li>
        )}

        {/* ── IT Help Desk ── */}
        {showIT && (
          <li>
            {(isOnITTeam || canManageIT) ? (
              <>
                <button
                  onClick={() => {
                    setItOpen((prev) => {
                      if (!prev) { setFacilitiesOpen(() => false); setAvOpen(() => false) }
                      return !prev
                    })
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl transition-colors duration-200 border border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
                    itOpen ? 'text-slate-900 font-semibold bg-[rgb(236,241,252)]' : 'text-slate-600 hover:bg-white/30 hover:text-slate-900'
                  }`}
                  aria-expanded={itOpen}
                  aria-label={itOpen ? 'Collapse IT Help Desk' : 'Expand IT Help Desk'}
                >
                  <Monitor className={`w-5 h-5 flex-shrink-0 ${itOpen ? 'text-primary-500' : 'text-slate-600'}`} aria-hidden="true" />
                  <span className="text-sm">IT Help Desk</span>
                  <motion.span
                    className="ml-auto block"
                    animate={{ rotate: itOpen ? 180 : 0 }}
                    transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                  >
                    <ChevronDown className="w-4 h-4 text-slate-400" aria-hidden="true" />
                  </motion.span>
                </button>
                <div
                  ref={itIndicator.containerRefCb}
                  className="relative ml-8 mt-1 overflow-hidden"
                  style={{
                    maxHeight: itOpen ? '600px' : '0px',
                    opacity: itOpen ? 1 : 0,
                    transition: 'max-height 0.25s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.2s ease',
                  }}
                >
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-full bg-slate-300/40" />
                  <div
                    ref={itIndicator.trailRefCb}
                    className="absolute left-0 w-0.5 rounded-full pointer-events-none"
                    style={{ filter: 'blur(1.5px)' }}
                  />
                  <motion.div
                    className="absolute left-0 w-0.5 rounded-full pointer-events-none"
                    style={{
                      top: itIndicator.indicatorTop,
                      height: itIndicator.indicatorHeight,
                      opacity: itIndicator.indicatorOpacity,
                      background: 'linear-gradient(180deg, #3B82F6 0%, #6366F1 100%)',
                      boxShadow: '0 0 8px rgba(59, 130, 246, 0.5), 0 0 16px rgba(99, 102, 241, 0.25)',
                    }}
                  />
                  <div className="space-y-0.5">
                    <PrefetchLink
                      href="/it"
                      data-it-active={pathname === '/it' ? 'true' : undefined}
                      onClick={() => { closePanels(); setFacilitiesOpen(() => false) }}
                      className={`flex items-center pl-4 pr-3 py-2.5 min-h-[40px] rounded-lg transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
                        pathname === '/it' ? 'text-slate-900 font-medium' : 'text-slate-500 hover:text-slate-800'
                      }`}
                      aria-current={pathname === '/it' ? 'page' : undefined}
                    >
                      <span className="text-sm">Help Desk</span>
                    </PrefetchLink>
                    {(isOnITTeam || canSeeITDevices) && (
                      <PrefetchLink
                        href="/it/devices"
                        data-it-active={pathname === '/it/devices' ? 'true' : undefined}
                        onClick={() => { closePanels(); setFacilitiesOpen(() => false) }}
                        className={`flex items-center pl-4 pr-3 py-2.5 min-h-[40px] rounded-lg transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
                          pathname === '/it/devices' ? 'text-slate-900 font-medium' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <span className="text-sm">Devices</span>
                      </PrefetchLink>
                    )}
                    {(isOnITTeam || canSeeITLifecycle) && (
                      <PrefetchLink
                        href="/it/lifecycle"
                        data-it-active={pathname === '/it/lifecycle' ? 'true' : undefined}
                        onClick={() => { closePanels(); setFacilitiesOpen(() => false) }}
                        className={`flex items-center pl-4 pr-3 py-2.5 min-h-[40px] rounded-lg transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
                          pathname === '/it/lifecycle' ? 'text-slate-900 font-medium' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <span className="text-sm">Lifecycle</span>
                      </PrefetchLink>
                    )}
                    {(isOnITTeam || canSeeITSecurity) && (
                      <PrefetchLink
                        href="/it/security"
                        data-it-active={pathname === '/it/security' ? 'true' : undefined}
                        onClick={() => { closePanels(); setFacilitiesOpen(() => false) }}
                        className={`flex items-center pl-4 pr-3 py-2.5 min-h-[40px] rounded-lg transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
                          pathname === '/it/security' ? 'text-slate-900 font-medium' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <span className="text-sm">Security</span>
                      </PrefetchLink>
                    )}
                    {(isOnITTeam || canSeeITAdmin) && (
                      <PrefetchLink
                        href="/it/admin"
                        data-it-active={pathname === '/it/admin' ? 'true' : undefined}
                        onClick={() => { closePanels(); setFacilitiesOpen(() => false) }}
                        className={`flex items-center pl-4 pr-3 py-2.5 min-h-[40px] rounded-lg transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
                          pathname === '/it/admin' ? 'text-slate-900 font-medium' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <span className="text-sm">Reports & Admin</span>
                      </PrefetchLink>
                    )}
                    {canReadInventory && (isOnITTeam || canManageIT) && (
                      <PrefetchLink
                        href="/inventory?dept=it"
                        data-it-active={pathname === '/inventory' && pageSearchParams.get('dept') === 'it' ? 'true' : undefined}
                        onClick={() => { closePanels(); setFacilitiesOpen(() => false) }}
                        className={`flex items-center pl-4 pr-3 py-2.5 min-h-[40px] rounded-lg transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
                          pathname === '/inventory' && pageSearchParams.get('dept') === 'it' ? 'text-slate-900 font-medium' : 'text-slate-500 hover:text-slate-800'
                        }`}
                        aria-current={pathname === '/inventory' && pageSearchParams.get('dept') === 'it' ? 'page' : undefined}
                      >
                        <span className="text-sm">Inventory</span>
                      </PrefetchLink>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <PrefetchLink
                href="/it"
                onClick={() => { closePanels(); setFacilitiesOpen(() => false) }}
                className={`flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
                  isITPath ? 'text-slate-900 font-medium' : 'text-slate-600 hover:text-slate-900 border border-transparent'
                }`}
                style={isITPath ? { background: 'linear-gradient(135deg, #c8d4e4, #d4dbe8, #ddd8e8)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.5)' } : {}}
                aria-current={isITPath ? 'page' : undefined}
              >
                <Monitor className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                <span className="text-sm">IT Help Desk</span>
              </PrefetchLink>
            )}
          </li>
        )}

        {/* ── A/V Production ── */}
        {showAV && (
          <li>
            <button
              onClick={() => {
                setAvOpen((prev) => {
                  if (!prev) { setFacilitiesOpen(() => false); setItOpen(() => false) }
                  return !prev
                })
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl transition-colors duration-200 border border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
                avOpen ? 'text-slate-900 font-semibold bg-[rgb(236,241,252)]' : 'text-slate-600 hover:bg-white/30 hover:text-slate-900'
              }`}
              aria-expanded={avOpen}
              aria-label={avOpen ? 'Collapse A/V Production' : 'Expand A/V Production'}
            >
              <Video className={`w-5 h-5 flex-shrink-0 ${avOpen ? 'text-primary-500' : 'text-slate-600'}`} aria-hidden="true" />
              <span className="text-sm">A/V Production</span>
              {!avOpen && (avGateCount?.count ?? 0) > 0 && (
                <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold leading-none ml-auto">
                  {avGateCount!.count}
                </span>
              )}
              <motion.span
                className={`${!avOpen && (avGateCount?.count ?? 0) > 0 ? '' : 'ml-auto'} block`}
                animate={{ rotate: avOpen ? 180 : 0 }}
                transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              >
                <ChevronDown className="w-4 h-4 text-slate-400" aria-hidden="true" />
              </motion.span>
            </button>
            <div
              className="relative ml-8 mt-1 overflow-hidden"
              style={{
                maxHeight: avOpen ? '200px' : '0px',
                opacity: avOpen ? 1 : 0,
                transition: 'max-height 0.25s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.2s ease',
              }}
            >
              <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-full bg-slate-300/40" />
              <div className="space-y-0.5 py-1">
                {canReadInventory && (
                  <PrefetchLink
                    href="/inventory"
                    onClick={closePanels}
                    className={`flex items-center pl-4 pr-3 py-2.5 min-h-[40px] rounded-lg transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
                      pathname === '/inventory' && !pageSearchParams.get('dept') ? 'text-slate-900 font-medium' : 'text-slate-500 hover:text-slate-800'
                    }`}
                    aria-current={pathname === '/inventory' && !pageSearchParams.get('dept') ? 'page' : undefined}
                  >
                    <span className="text-sm">Inventory</span>
                  </PrefetchLink>
                )}
                <PrefetchLink
                  href="/av/event-approvals"
                  onClick={closePanels}
                  className={`flex items-center justify-between pl-4 pr-3 py-2.5 min-h-[40px] rounded-lg transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
                    pathname === '/av/event-approvals' ? 'text-slate-900 font-medium' : 'text-slate-500 hover:text-slate-800'
                  }`}
                  aria-current={pathname === '/av/event-approvals' ? 'page' : undefined}
                >
                  <span className="text-sm">Event Approvals</span>
                  {(avGateCount?.count ?? 0) > 0 && (
                    <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold leading-none">
                      {avGateCount!.count}
                    </span>
                  )}
                </PrefetchLink>
              </div>
            </div>
          </li>
        )}
      </ul>
    </>
  )
}
