'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { X, ChevronRight, Music, Film, FileText, ListOrdered, ArrowDownToLine, ArrowUpFromLine, RefreshCw, Check, Loader2, ExternalLink, Unlink, ChevronLeft, Link2, Plus, Unplug } from 'lucide-react'
import { useToast } from '@/components/Toast'
import {
  usePCOServiceTypes,
  usePCOPlans,
  usePCOPlanItems,
  usePCOServiceLink,
  useImportPCOPlan,
  usePushToPCO,
  useUnlinkPCO,
  useUnlinkPCOItem,
} from '@/lib/hooks/usePCOServices'
import type { PCOServiceType, PCOPlanSummary, PCOPlanItem, PCOServiceLink } from '@/lib/hooks/usePCOServices'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PCOServiceLinkModalProps {
  eventProjectId: string
  sectionId: string
  sectionTitle: string
  onClose: () => void
}

type Step = 'service-types' | 'plans' | 'preview' | 'linked'

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—'
  const m = Math.round(seconds / 60)
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`
}

function itemTypeIcon(type: PCOPlanItem['itemType']) {
  switch (type) {
    case 'song': return <Music className="w-4 h-4 text-indigo-500" />
    case 'media': return <Film className="w-4 h-4 text-purple-500" />
    case 'header': return <ListOrdered className="w-4 h-4 text-slate-400" />
    default: return <FileText className="w-4 h-4 text-slate-500" />
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export function PCOServiceLinkModal({
  eventProjectId,
  sectionId,
  sectionTitle,
  onClose,
}: PCOServiceLinkModalProps) {
  const { toast } = useToast()
  const [step, setStep] = useState<Step>('service-types')
  const [selectedServiceType, setSelectedServiceType] = useState<PCOServiceType | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<PCOPlanSummary | null>(null)
  const [syncDirection, setSyncDirection] = useState<'import_only' | 'export_only' | 'both'>('both')
  const [planFilter, setPlanFilter] = useState<'future' | 'past'>('future')
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())

  // Queries
  const { data: serviceTypes, isLoading: loadingTypes } = usePCOServiceTypes(eventProjectId)
  const { data: plans, isLoading: loadingPlans } = usePCOPlans(
    eventProjectId,
    selectedServiceType?.id,
    planFilter
  )
  const { data: planDetail, isLoading: loadingItems } = usePCOPlanItems(
    eventProjectId,
    selectedServiceType?.id,
    selectedPlan?.id
  )
  const { data: existingLink } = usePCOServiceLink(eventProjectId, sectionId)

  // Fetch live PCO items when in linked mode (to show synced vs new)
  const { data: linkedPlanDetail, isLoading: loadingLinkedItems } = usePCOPlanItems(
    eventProjectId,
    existingLink?.pcoServiceTypeId,
    existingLink?.pcoPlanId
  )

  // Mutations
  const importPlan = useImportPCOPlan(eventProjectId)
  const pushToPCO = usePushToPCO(eventProjectId)
  const unlinkPCO = useUnlinkPCO(eventProjectId)
  const unlinkItem = useUnlinkPCOItem(eventProjectId)

  // State for selecting new (unsynced) items in linked view
  const [selectedNewItemIds, setSelectedNewItemIds] = useState<Set<string>>(new Set())

  // Auto-select all non-header items when plan items load (for initial import preview)
  useEffect(() => {
    if (planDetail?.items) {
      const nonHeaders = planDetail.items.filter((i) => i.itemType !== 'header').map((i) => i.id)
      setSelectedItemIds(new Set(nonHeaders))
    }
  }, [planDetail])

  // Build a set of mapped PCO item IDs for quick lookup in linked view
  const mappedPcoItemIds = useMemo(() => {
    if (!existingLink?.itemMappings) return new Set<string>()
    return new Set(existingLink.itemMappings.map((m) => m.pcoItemId))
  }, [existingLink])

  // Count of new (unmapped) items in the linked plan
  const newItemCount = useMemo(() => {
    if (!linkedPlanDetail?.items || !existingLink) return 0
    return linkedPlanDetail.items.filter(
      (i) => i.itemType !== 'header' && !mappedPcoItemIds.has(i.id)
    ).length
  }, [linkedPlanDetail, existingLink, mappedPcoItemIds])

  // Check if already linked
  const isLinked = !!existingLink

  // Switch to 'linked' step when existing link data loads
  useEffect(() => {
    if (existingLink) setStep('linked')
  }, [existingLink])

  const handleSelectServiceType = useCallback((type: PCOServiceType) => {
    setSelectedServiceType(type)
    setStep('plans')
  }, [])

  const handleSelectPlan = useCallback((plan: PCOPlanSummary) => {
    setSelectedPlan(plan)
    setStep('preview')
  }, [])

  const toggleItem = useCallback((itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }, [])

  const toggleAllItems = useCallback(() => {
    if (!planDetail?.items) return
    const nonHeaders = planDetail.items.filter((i) => i.itemType !== 'header').map((i) => i.id)
    if (selectedItemIds.size === nonHeaders.length) {
      setSelectedItemIds(new Set())
    } else {
      setSelectedItemIds(new Set(nonHeaders))
    }
  }, [planDetail, selectedItemIds.size])

  const handleImport = useCallback(async () => {
    if (!selectedServiceType || !selectedPlan) return
    if (selectedItemIds.size === 0) {
      toast('Select at least one item to import', 'warning')
      return
    }

    try {
      const result = await importPlan.mutateAsync({
        sectionId,
        serviceTypeId: selectedServiceType.id,
        planId: selectedPlan.id,
        syncDirection,
        selectedItemIds: Array.from(selectedItemIds),
      })

      if (result.errors.length > 0) {
        toast(`Imported with ${result.errors.length} warning(s)`, 'warning')
      } else {
        toast(`Imported ${result.blocksCreated} items, updated ${result.blocksUpdated}`, 'success')
      }
      // Small delay to let query invalidation fire before unmounting
      setTimeout(onClose, 100)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Import failed', 'error')
    }
  }, [selectedServiceType, selectedPlan, sectionId, syncDirection, selectedItemIds, importPlan, onClose, toast])

  const handlePush = useCallback(async () => {
    try {
      const result = await pushToPCO.mutateAsync(sectionId)
      if (result.errors.length > 0) {
        toast(`Pushed with ${result.errors.length} warning(s)`, 'warning')
      } else {
        toast(`Pushed ${result.itemsUpdated} items to Planning Center`, 'success')
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Push failed', 'error')
    }
  }, [sectionId, pushToPCO])

  const handleUnlink = useCallback(async () => {
    try {
      await unlinkPCO.mutateAsync(sectionId)
      toast('Unlinked from Planning Center', 'success')
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Unlink failed', 'error')
    }
  }, [sectionId, unlinkPCO, onClose])

  const handleResync = useCallback(async () => {
    if (!existingLink) return
    try {
      const result = await importPlan.mutateAsync({
        sectionId,
        serviceTypeId: existingLink.pcoServiceTypeId,
        planId: existingLink.pcoPlanId,
        syncDirection: existingLink.syncDirection,
      })
      toast(`Re-synced: ${result.blocksCreated} new, ${result.blocksUpdated} updated`, 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Re-sync failed', 'error')
    }
  }, [existingLink, sectionId, importPlan])

  const toggleNewItem = useCallback((itemId: string) => {
    setSelectedNewItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }, [])

  const handleImportNewItems = useCallback(async () => {
    if (!existingLink || selectedNewItemIds.size === 0) return
    try {
      const result = await importPlan.mutateAsync({
        sectionId,
        serviceTypeId: existingLink.pcoServiceTypeId,
        planId: existingLink.pcoPlanId,
        syncDirection: existingLink.syncDirection,
        selectedItemIds: Array.from(selectedNewItemIds),
      })
      toast(`Added ${result.blocksCreated} new item${result.blocksCreated !== 1 ? 's' : ''}`, 'success')
      setSelectedNewItemIds(new Set())
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Import failed', 'error')
    }
  }, [existingLink, selectedNewItemIds, sectionId, importPlan, toast])

  const handleUnlinkItem = useCallback(async (pcoItemId: string, itemTitle: string) => {
    try {
      await unlinkItem.mutateAsync({ sectionId, pcoItemId, deleteBlock: false })
      toast(`Unsynced "${itemTitle}" — item kept in schedule`, 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to unsync item', 'error')
    }
  }, [sectionId, unlinkItem, toast])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            {step !== 'service-types' && step !== 'linked' && (
              <button
                onClick={() => {
                  if (step === 'preview') setStep('plans')
                  else if (step === 'plans') setStep('service-types')
                }}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {step === 'linked' ? 'Planning Center Link' : 'Link to Planning Center'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">{sectionTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* ── Step: Service Types ── */}
          {step === 'service-types' && (
            <div className="p-4">
              <p className="text-sm text-slate-600 mb-4">Select a service type from your Planning Center account:</p>
              {loadingTypes ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                </div>
              ) : serviceTypes && serviceTypes.length > 0 ? (
                <div className="space-y-1.5">
                  {serviceTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => handleSelectServiceType(type)}
                      className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all cursor-pointer group"
                    >
                      <div className="text-left">
                        <div className="text-sm font-medium text-slate-900">{type.name}</div>
                        {type.frequency && (
                          <div className="text-xs text-slate-400 mt-0.5">{type.frequency}</div>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-8">No service types found in Planning Center</p>
              )}
            </div>
          )}

          {/* ── Step: Plans ── */}
          {step === 'plans' && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-600">
                  Select a plan from <span className="font-medium">{selectedServiceType?.name}</span>:
                </p>
                <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
                  <button
                    onClick={() => setPlanFilter('future')}
                    className={`px-2.5 py-1 text-xs rounded-md transition-all cursor-pointer ${planFilter === 'future' ? 'bg-white text-slate-900 shadow-sm font-medium' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Upcoming
                  </button>
                  <button
                    onClick={() => setPlanFilter('past')}
                    className={`px-2.5 py-1 text-xs rounded-md transition-all cursor-pointer ${planFilter === 'past' ? 'bg-white text-slate-900 shadow-sm font-medium' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Past
                  </button>
                </div>
              </div>
              {loadingPlans ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                </div>
              ) : plans && plans.length > 0 ? (
                <div className="space-y-1.5">
                  {plans.map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => handleSelectPlan(plan)}
                      className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all cursor-pointer group"
                    >
                      <div className="text-left">
                        <div className="text-sm font-medium text-slate-900">
                          {plan.title || plan.dates || 'Untitled Plan'}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {plan.dates && plan.title && (
                            <span className="text-xs text-slate-400">{plan.dates}</span>
                          )}
                          {plan.seriesTitle && (
                            <span className="text-xs text-indigo-500">{plan.seriesTitle}</span>
                          )}
                          <span className="text-xs text-slate-400">{plan.itemCount} items</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-8">No {planFilter} plans found</p>
              )}
            </div>
          )}

          {/* ── Step: Preview ── */}
          {step === 'preview' && (
            <div className="p-4">
              <div className="bg-slate-50 rounded-xl p-3.5 mb-4">
                <div className="text-sm font-medium text-slate-900">
                  {selectedPlan?.title || selectedPlan?.dates || 'Untitled Plan'}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {selectedPlan?.dates && selectedPlan?.title && (
                    <span className="text-xs text-slate-500">{selectedPlan.dates}</span>
                  )}
                  <span className="text-xs text-slate-400">{selectedServiceType?.name}</span>
                </div>
              </div>

              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Items</p>
                {planDetail?.items && planDetail.items.filter((i) => i.itemType !== 'header').length > 0 && (
                  <button
                    onClick={toggleAllItems}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors cursor-pointer"
                  >
                    {selectedItemIds.size === planDetail.items.filter((i) => i.itemType !== 'header').length
                      ? 'Deselect all'
                      : 'Select all'}
                  </button>
                )}
              </div>

              {loadingItems ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                </div>
              ) : planDetail?.items && planDetail.items.length > 0 ? (
                <div className="space-y-1 mb-4">
                  {planDetail.items.map((item) => {
                    const isHeader = item.itemType === 'header'
                    const isSelected = selectedItemIds.has(item.id)
                    return (
                      <div
                        key={item.id}
                        onClick={isHeader ? undefined : () => toggleItem(item.id)}
                        className={`flex items-center gap-3 p-2.5 rounded-lg transition-all ${
                          isHeader
                            ? 'bg-slate-50'
                            : isSelected
                              ? 'bg-white border border-indigo-200 cursor-pointer hover:border-indigo-300'
                              : 'bg-slate-50/50 border border-slate-100 cursor-pointer hover:border-slate-200 opacity-60'
                        }`}
                      >
                        {!isHeader && (
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                        )}
                        {itemTypeIcon(item.itemType)}
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm truncate ${isHeader ? 'font-semibold text-slate-600 uppercase text-xs tracking-wider' : 'font-medium text-slate-900'}`}>
                            {item.title}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {item.key && (
                              <span className="text-xs text-indigo-500">Key: {item.key}</span>
                            )}
                            {item.servicePosition === 'pre' && (
                              <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">Pre</span>
                            )}
                            {item.servicePosition === 'post' && (
                              <span className="text-[10px] font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">Post</span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-slate-400 tabular-nums flex-shrink-0">
                          {formatDuration(item.length)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-4">No items in this plan</p>
              )}

              {/* Sync direction selector */}
              <div className="border-t border-slate-100 pt-4 mt-4">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Sync Mode</p>
                <div className="space-y-1.5">
                  {[
                    { value: 'both' as const, icon: RefreshCw, label: 'Two-way sync', desc: 'Changes sync both directions' },
                    { value: 'import_only' as const, icon: ArrowDownToLine, label: 'Import only', desc: 'Pull from PCO, no push back' },
                    { value: 'export_only' as const, icon: ArrowUpFromLine, label: 'Export only', desc: 'Push to PCO, no pull' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSyncDirection(opt.value)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                        syncDirection === opt.value
                          ? 'border-indigo-300 bg-indigo-50'
                          : 'border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      <opt.icon className={`w-4 h-4 ${syncDirection === opt.value ? 'text-indigo-600' : 'text-slate-400'}`} />
                      <div className="text-left">
                        <div className={`text-sm font-medium ${syncDirection === opt.value ? 'text-indigo-900' : 'text-slate-700'}`}>
                          {opt.label}
                        </div>
                        <div className="text-xs text-slate-400">{opt.desc}</div>
                      </div>
                      {syncDirection === opt.value && (
                        <Check className="w-4 h-4 text-indigo-600 ml-auto" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step: Linked (full item list with sync status) ── */}
          {step === 'linked' && existingLink && (
            <div className="p-4">
              {/* Connection info bar */}
              <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <div>
                    <div className="text-sm font-medium text-slate-900">
                      {existingLink.pcoPlanTitle || 'Untitled Plan'}
                    </div>
                    <div className="text-xs text-slate-400">
                      {existingLink.pcoServiceTypeName || 'Planning Center Services'}
                    </div>
                  </div>
                </div>
                <a
                  href={`https://services.planningcenteronline.com/plans/${existingLink.pcoPlanId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              {/* Item list header */}
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Items</p>
                {existingLink.lastSyncAt && (
                  <span className="text-xs text-slate-400">
                    Synced {new Date(existingLink.lastSyncAt).toLocaleTimeString()}
                  </span>
                )}
              </div>

              {/* Item list */}
              {loadingLinkedItems ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                </div>
              ) : linkedPlanDetail?.items && linkedPlanDetail.items.length > 0 ? (
                <div className="space-y-1 mb-4">
                  {linkedPlanDetail.items.map((item) => {
                    const isHeader = item.itemType === 'header'
                    const isSynced = mappedPcoItemIds.has(item.id)
                    const isNew = !isHeader && !isSynced
                    const isNewSelected = selectedNewItemIds.has(item.id)

                    return (
                      <div
                        key={item.id}
                        onClick={isNew ? () => toggleNewItem(item.id) : undefined}
                        className={`flex items-center gap-3 p-2.5 rounded-lg transition-all ${
                          isHeader
                            ? 'bg-slate-50'
                            : isSynced
                              ? 'bg-white border border-slate-100'
                              : isNewSelected
                                ? 'bg-indigo-50 border border-indigo-200 cursor-pointer hover:border-indigo-300'
                                : 'bg-amber-50/50 border border-amber-200 cursor-pointer hover:border-amber-300'
                        }`}
                      >
                        {/* Checkbox for new items / sync icon for synced */}
                        {!isHeader && isNew && (
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            isNewSelected ? 'bg-indigo-600 border-indigo-600' : 'border-amber-400 bg-white'
                          }`}>
                            {isNewSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                        )}
                        {!isHeader && isSynced && (
                          <Link2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                        )}
                        {itemTypeIcon(item.itemType)}
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm truncate ${isHeader ? 'font-semibold text-slate-600 uppercase text-xs tracking-wider' : 'font-medium text-slate-900'}`}>
                            {item.title}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {item.key && (
                              <span className="text-xs text-indigo-500">Key: {item.key}</span>
                            )}
                            {item.servicePosition === 'pre' && (
                              <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">Pre</span>
                            )}
                            {item.servicePosition === 'post' && (
                              <span className="text-[10px] font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">Post</span>
                            )}
                          </div>
                        </div>
                        {!isHeader && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-slate-400 tabular-nums">
                              {formatDuration(item.length)}
                            </span>
                            {isSynced && (
                              <span className="text-[10px] font-medium text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">
                                Synced
                              </span>
                            )}
                            {isSynced && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleUnlinkItem(item.id, item.title)
                                }}
                                disabled={unlinkItem.isPending}
                                title="Unsync this item"
                                className="p-1 rounded-md hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <Unplug className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {isNew && !isNewSelected && (
                              <span className="text-[10px] font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                                New
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-4">No items in this plan</p>
              )}

              {/* Actions */}
              <div className="border-t border-slate-100 pt-3 mt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleResync}
                    disabled={importPlan.isPending}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/50 text-sm font-medium text-slate-700 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {importPlan.isPending && !selectedNewItemIds.size ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    Re-sync
                  </button>
                  {existingLink.syncDirection !== 'import_only' && (
                    <button
                      onClick={handlePush}
                      disabled={pushToPCO.isPending}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:border-purple-200 hover:bg-purple-50/50 text-sm font-medium text-slate-700 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {pushToPCO.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ArrowUpFromLine className="w-3.5 h-3.5" />
                      )}
                      Push to PCO
                    </button>
                  )}
                </div>
                <button
                  onClick={handleUnlink}
                  disabled={unlinkPCO.isPending}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-red-100 hover:border-red-200 hover:bg-red-50/50 text-xs font-medium text-red-600 transition-all cursor-pointer disabled:opacity-50"
                >
                  {unlinkPCO.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Unlink className="w-3 h-3" />
                  )}
                  Unlink from PCO
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'preview' && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {selectedItemIds.size} of {planDetail?.items.filter((i) => i.itemType !== 'header').length || 0} items selected
            </span>
            <button
              onClick={handleImport}
              disabled={importPlan.isPending}
              className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-2"
            >
              {importPlan.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <ArrowDownToLine className="w-4 h-4" />
                  Import Plan
                </>
              )}
            </button>
          </div>
        )}

        {step === 'linked' && selectedNewItemIds.size > 0 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {selectedNewItemIds.size} new item{selectedNewItemIds.size !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={handleImportNewItems}
              disabled={importPlan.isPending}
              className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-2"
            >
              {importPlan.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Import Selected
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
