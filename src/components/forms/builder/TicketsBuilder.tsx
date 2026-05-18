'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Ticket,
  Plus,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Copy,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Tag,
  Users,
  Clock,
  DollarSign,
  ScanLine,
  ChevronRight,
  Download,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { fetchApi } from '@/lib/api-client'
import { queryKeys } from '@/lib/queries'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/Toast'

// ─── Types ─────────────────────────────────────────────────────────────────

interface TicketTypeData {
  id: string
  name: string
  description: string | null
  price: number // cents
  maxPerOrder: number | null
  totalInventory: number | null
  soldCount: number
  sortOrder: number
  salesStartAt: string | null
  salesEndAt: string | null
  isActive: boolean
  depositPercent: number | null
}

interface PromoCode {
  code: string
  percentOff: number | null
  amountOff: number | null
  maxUses: number | null
  usedCount: number
}

interface TicketsConfig {
  ticketTypes: TicketTypeData[]
  maxCapacity: number | null
  waitlistEnabled: boolean
  discountCodes: PromoCode[]
}

// ─── Ticket Type Editor ────────────────────────────────────────────────────

interface TicketTypeEditorProps {
  initial?: Partial<TicketTypeData>
  onSave: (data: Omit<TicketTypeData, 'id' | 'soldCount' | 'sortOrder'>) => void
  onCancel: () => void
  saving: boolean
}

function TicketTypeEditor({ initial, onSave, onCancel, saving }: TicketTypeEditorProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [price, setPrice] = useState(initial?.price != null ? (initial.price / 100).toFixed(2) : '')
  const [maxPerOrder, setMaxPerOrder] = useState(initial?.maxPerOrder?.toString() ?? '')
  const [totalInventory, setTotalInventory] = useState(initial?.totalInventory?.toString() ?? '')
  const [salesStartAt, setSalesStartAt] = useState(initial?.salesStartAt?.slice(0, 16) ?? '')
  const [salesEndAt, setSalesEndAt] = useState(initial?.salesEndAt?.slice(0, 16) ?? '')
  const [depositPercent, setDepositPercent] = useState(initial?.depositPercent?.toString() ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const dollars = parseFloat(price)
    if (!name.trim() || isNaN(dollars) || dollars < 0) return

    onSave({
      name: name.trim(),
      description: description.trim() || null,
      price: Math.round(dollars * 100),
      maxPerOrder: maxPerOrder ? parseInt(maxPerOrder) : null,
      totalInventory: totalInventory ? parseInt(totalInventory) : null,
      salesStartAt: salesStartAt || null,
      salesEndAt: salesEndAt || null,
      isActive: initial?.isActive ?? true,
      depositPercent: depositPercent ? parseInt(depositPercent) : null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Adult, Child (5-12), VIP"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Description (optional)</label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's included with this ticket"
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Price ($)</label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Type limit (optional)</label>
          <Input
            type="number"
            min="1"
            value={totalInventory}
            onChange={(e) => setTotalInventory(e.target.value)}
            placeholder="No limit"
          />
          <p className="text-[10px] text-slate-400 mt-1">Cap this specific tier (e.g. only 20 VIP). Leave blank to share from overall capacity.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Max per order</label>
          <Input
            type="number"
            min="1"
            value={maxPerOrder}
            onChange={(e) => setMaxPerOrder(e.target.value)}
            placeholder="10"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Deposit % (optional)</label>
          <Input
            type="number"
            min="0"
            max="100"
            value={depositPercent}
            onChange={(e) => setDepositPercent(e.target.value)}
            placeholder="Full payment"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Sale starts</label>
          <Input
            type="datetime-local"
            value={salesStartAt}
            onChange={(e) => setSalesStartAt(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Sale ends</label>
          <Input
            type="datetime-local"
            value={salesEndAt}
            onChange={(e) => setSalesEndAt(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !name.trim() || !price}
          className="px-5 py-2 text-sm font-medium text-white bg-slate-900 rounded-full hover:bg-slate-800 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50"
        >
          {saving ? 'Saving...' : initial?.name ? 'Update' : 'Add Ticket Type'}
        </button>
      </div>
    </form>
  )
}

// ─── Promo Code Editor ─────────────────────────────────────────────────────

interface PromoCodeEditorProps {
  initial?: PromoCode
  onSave: (code: PromoCode) => void
  onCancel: () => void
}

function PromoCodeEditor({ initial, onSave, onCancel }: PromoCodeEditorProps) {
  const [code, setCode] = useState(initial?.code ?? '')
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>(
    initial?.amountOff ? 'fixed' : 'percent'
  )
  const [value, setValue] = useState(
    initial?.percentOff?.toString() ?? initial?.amountOff ? ((initial?.amountOff ?? 0) / 100).toFixed(2) : ''
  )
  const [maxUses, setMaxUses] = useState(initial?.maxUses?.toString() ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim() || !value) return

    const numValue = parseFloat(value)
    onSave({
      code: code.trim().toUpperCase(),
      percentOff: discountType === 'percent' ? numValue : null,
      amountOff: discountType === 'fixed' ? Math.round(numValue * 100) : null,
      maxUses: maxUses ? parseInt(maxUses) : null,
      usedCount: initial?.usedCount ?? 0,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Code</label>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. EARLYBIRD"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Discount type</label>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setDiscountType('percent')}
              className={`flex-1 px-3 py-2 text-xs font-medium cursor-pointer transition-colors ${
                discountType === 'percent' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              % Off
            </button>
            <button
              type="button"
              onClick={() => setDiscountType('fixed')}
              className={`flex-1 px-3 py-2 text-xs font-medium cursor-pointer transition-colors ${
                discountType === 'fixed' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              $ Off
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            {discountType === 'percent' ? 'Percentage' : 'Amount ($)'}
          </label>
          <Input
            type="number"
            min="0"
            step={discountType === 'percent' ? '1' : '0.01'}
            max={discountType === 'percent' ? '100' : undefined}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={discountType === 'percent' ? '10' : '5.00'}
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Max uses (optional)</label>
        <Input
          type="number"
          min="1"
          value={maxUses}
          onChange={(e) => setMaxUses(e.target.value)}
          placeholder="Unlimited"
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!code.trim() || !value}
          className="px-5 py-2 text-sm font-medium text-white bg-slate-900 rounded-full hover:bg-slate-800 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50"
        >
          {initial?.code ? 'Update' : 'Add Code'}
        </button>
      </div>
    </form>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────

interface TicketsBuilderProps {
  formDefinitionId: string
}

export default function TicketsBuilder({ formDefinitionId }: TicketsBuilderProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [editingId, setEditingId] = useState<string | null>(null) // ticket type being edited
  const [showAddType, setShowAddType] = useState(false)
  const [showAddPromo, setShowAddPromo] = useState(false)
  const [editingPromo, setEditingPromo] = useState<string | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  // ─── Fetch ticket config ────────────────────────────────────────────────
  const { data: config, isLoading } = useQuery<TicketsConfig>({
    queryKey: queryKeys.forms.tickets(formDefinitionId),
    queryFn: () => fetchApi<TicketsConfig>(`/api/forms/${formDefinitionId}/tickets`),
    staleTime: 30_000,
  })

  // ─── Mutations ──────────────────────────────────────────────────────────
  const addTypeMutation = useMutation({
    mutationFn: (data: Omit<TicketTypeData, 'id' | 'soldCount' | 'sortOrder'>) =>
      fetchApi(`/api/forms/${formDefinitionId}/tickets`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.forms.tickets(formDefinitionId) })
      setShowAddType(false)
      toast('Ticket type added', 'success')
    },
    onError: () => toast('Failed to add ticket type', 'error'),
  })

  const updateTypeMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<TicketTypeData>) =>
      fetchApi(`/api/forms/${formDefinitionId}/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.forms.tickets(formDefinitionId) })
      setEditingId(null)
      toast('Ticket type updated', 'success')
    },
    onError: () => toast('Failed to update ticket type', 'error'),
  })

  const deleteTypeMutation = useMutation({
    mutationFn: (id: string) =>
      fetchApi(`/api/forms/${formDefinitionId}/tickets/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.forms.tickets(formDefinitionId) })
      toast('Ticket type deleted', 'success')
    },
    onError: () => toast('Failed to delete ticket type', 'error'),
  })

  const updateConfigMutation = useMutation({
    mutationFn: (data: { maxCapacity?: number | null; waitlistEnabled?: boolean; discountCodes?: PromoCode[] }) =>
      fetchApi(`/api/forms/${formDefinitionId}/tickets/config`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.forms.tickets(formDefinitionId) })
    },
    onError: () => toast('Failed to update settings', 'error'),
  })

  // ─── Handlers ───────────────────────────────────────────────────────────

  function handleDuplicate(ticketType: TicketTypeData) {
    addTypeMutation.mutate({
      name: `${ticketType.name} (copy)`,
      description: ticketType.description,
      price: ticketType.price,
      maxPerOrder: ticketType.maxPerOrder,
      totalInventory: ticketType.totalInventory,
      salesStartAt: ticketType.salesStartAt,
      salesEndAt: ticketType.salesEndAt,
      isActive: ticketType.isActive,
      depositPercent: ticketType.depositPercent,
    })
    setMenuOpenId(null)
  }

  function handleToggleActive(ticketType: TicketTypeData) {
    updateTypeMutation.mutate({ id: ticketType.id, isActive: !ticketType.isActive })
    setMenuOpenId(null)
  }

  function handleDeleteType(ticketType: TicketTypeData) {
    if (ticketType.soldCount > 0) {
      if (!confirm(`This ticket type has ${ticketType.soldCount} sold tickets. Are you sure you want to delete it?`)) return
    }
    deleteTypeMutation.mutate(ticketType.id)
    setMenuOpenId(null)
  }

  function handleSavePromo(promo: PromoCode) {
    const existing = config?.discountCodes ?? []
    const updated = editingPromo
      ? existing.map((p) => (p.code === editingPromo ? promo : p))
      : [...existing, promo]
    updateConfigMutation.mutate({ discountCodes: updated })
    setShowAddPromo(false)
    setEditingPromo(null)
    toast(editingPromo ? 'Promo code updated' : 'Promo code added', 'success')
  }

  function handleDeletePromo(code: string) {
    const updated = (config?.discountCodes ?? []).filter((p) => p.code !== code)
    updateConfigMutation.mutate({ discountCodes: updated })
    toast('Promo code removed', 'success')
  }

  // ─── Loading ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-6 w-40 bg-slate-200 rounded-lg" />
        <div className="h-32 bg-slate-100 rounded-xl" />
        <div className="h-32 bg-slate-100 rounded-xl" />
      </div>
    )
  }

  const ticketTypes = config?.ticketTypes ?? []
  const totalSold = ticketTypes.reduce((sum, t) => sum + t.soldCount, 0)

  // ─── Empty State ────────────────────────────────────────────────────────
  if (ticketTypes.length === 0 && !showAddType) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
          <Ticket className="w-7 h-7 text-indigo-500" />
        </div>
        <h3 className="text-base font-semibold text-slate-900 mb-2">
          Sell tickets with this form?
        </h3>
        <p className="text-sm text-slate-500 max-w-sm mb-6">
          Add ticket types so people can select and purchase admission when they fill out this form.
          No tickets? No problem — this form works perfectly without them.
        </p>
        <button
          onClick={() => setShowAddType(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-full hover:bg-slate-800 active:scale-[0.97] transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add first ticket type
        </button>
      </div>
    )
  }

  // ─── Main UI ────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-6 max-w-2xl mx-auto">

        {/* Reminder: add Tickets field to canvas */}
        {ticketTypes.length > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <Ticket className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-indigo-800">
                {"Don't forget to add a "}<strong>Tickets</strong>{" block to your form"}
              </p>
              <p className="text-[11px] text-indigo-600 mt-0.5">
                {"Go to the Fields tab → Layout section → drag the Tickets block onto your form where you want the ticket selector to appear."}
              </p>
            </div>
          </div>
        )}

        {/* ── Ticket Types ─────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Ticket className="w-4 h-4 text-slate-400" />
              Ticket Types
            </h3>
            {ticketTypes.length > 0 && !showAddType && (
              <button
                onClick={() => setShowAddType(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add type
              </button>
            )}
          </div>

          {/* Ticket type list */}
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {ticketTypes.map((tt) => (
                <motion.div
                  key={tt.id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  {editingId === tt.id ? (
                    <TicketTypeEditor
                      initial={tt}
                      onSave={(data) => updateTypeMutation.mutate({ id: tt.id, ...data })}
                      onCancel={() => setEditingId(null)}
                      saving={updateTypeMutation.isPending}
                    />
                  ) : (
                    <div
                      className={`bg-white border rounded-xl p-4 flex items-start gap-3 group transition-colors ${
                        tt.isActive ? 'border-slate-200' : 'border-slate-100 opacity-60'
                      }`}
                    >
                      <GripVertical className="w-4 h-4 text-slate-300 mt-0.5 cursor-grab flex-shrink-0" />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900">{tt.name}</span>
                          {!tt.isActive && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium text-slate-500 bg-slate-100 rounded">
                              Inactive
                            </span>
                          )}
                        </div>
                        {tt.description && (
                          <p className="text-xs text-slate-500 mt-0.5 truncate">{tt.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
                          {tt.totalInventory != null ? (
                            <span>{tt.soldCount}/{tt.totalInventory} sold</span>
                          ) : (
                            <span>{tt.soldCount} sold</span>
                          )}
                          {tt.maxPerOrder && <span>Max {tt.maxPerOrder}/order</span>}
                          {(tt.salesStartAt || tt.salesEndAt) && (
                            <span className="flex items-center gap-0.5">
                              <Clock className="w-3 h-3" />
                              {tt.salesStartAt && !tt.salesEndAt && 'From ' + new Date(tt.salesStartAt).toLocaleDateString()}
                              {!tt.salesStartAt && tt.salesEndAt && 'Until ' + new Date(tt.salesEndAt).toLocaleDateString()}
                              {tt.salesStartAt && tt.salesEndAt &&
                                new Date(tt.salesStartAt).toLocaleDateString() + ' – ' + new Date(tt.salesEndAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <span className="text-sm font-semibold text-slate-900 whitespace-nowrap">
                        ${(tt.price / 100).toFixed(2)}
                      </span>

                      {/* Three-dot menu */}
                      <div className="relative">
                        <button
                          onClick={() => setMenuOpenId(menuOpenId === tt.id ? null : tt.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {menuOpenId === tt.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuOpenId(null)} />
                            <div className="absolute right-0 top-8 z-20 w-40 bg-white border border-slate-200 rounded-xl shadow-lg py-1">
                              <button
                                onClick={() => { setEditingId(tt.id); setMenuOpenId(null) }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" /> Edit
                              </button>
                              <button
                                onClick={() => handleDuplicate(tt)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5" /> Duplicate
                              </button>
                              <button
                                onClick={() => handleToggleActive(tt)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                              >
                                {tt.isActive ? <ToggleLeft className="w-3.5 h-3.5" /> : <ToggleRight className="w-3.5 h-3.5" />}
                                {tt.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                onClick={() => handleDeleteType(tt)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Add ticket type form */}
          {showAddType && (
            <div className="mt-3">
              <TicketTypeEditor
                onSave={(data) => addTypeMutation.mutate(data)}
                onCancel={() => setShowAddType(false)}
                saving={addTypeMutation.isPending}
              />
            </div>
          )}

          {/* Add button when types exist but form is hidden */}
          {ticketTypes.length > 0 && !showAddType && (
            <button
              onClick={() => setShowAddType(true)}
              className="mt-3 w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium text-slate-500 border border-dashed border-slate-200 rounded-xl hover:border-slate-300 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add ticket type
            </button>
          )}
        </section>

        {/* ── Capacity ─────────────────────────────────────────────────── */}
        {ticketTypes.length > 0 && (
          <section className="border-t border-slate-100 pt-5">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-slate-400" />
              Capacity
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Total seats/spots available across all ticket types. Each ticket sold (Adult, Child, Senior, etc.) takes one spot from this shared pool.
            </p>
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line no-restricted-syntax -- builder setting */}
              <input
                type="number"
                min="1"
                value={config?.maxCapacity ?? ''}
                onChange={(e) => {
                  const val = parseInt(e.target.value)
                  updateConfigMutation.mutate({ maxCapacity: isNaN(val) ? null : val })
                }}
                placeholder="Unlimited"
                className="w-32 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <span className="text-xs text-slate-400">
                {totalSold > 0 && `${totalSold} sold`}
              </span>
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-slate-600">Enable waitlist when sold out</span>
              <button
                type="button"
                role="switch"
                aria-checked={config?.waitlistEnabled ?? false}
                onClick={() => updateConfigMutation.mutate({ waitlistEnabled: !(config?.waitlistEnabled ?? false) })}
                className={`relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors duration-200 cursor-pointer ${
                  config?.waitlistEnabled ? 'bg-indigo-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
                    config?.waitlistEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </section>
        )}

        {/* ── Promo Codes ──────────────────────────────────────────────── */}
        {ticketTypes.length > 0 && (
          <section className="border-t border-slate-100 pt-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Tag className="w-4 h-4 text-slate-400" />
                Promo Codes
              </h3>
              {!showAddPromo && (
                <button
                  onClick={() => setShowAddPromo(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add code
                </button>
              )}
            </div>

            {/* Existing codes */}
            {(config?.discountCodes ?? []).length > 0 && (
              <div className="space-y-2 mb-3">
                {(config?.discountCodes ?? []).map((promo) => (
                  <div key={promo.code} className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3">
                    {editingPromo === promo.code ? (
                      <div className="w-full">
                        <PromoCodeEditor
                          initial={promo}
                          onSave={handleSavePromo}
                          onCancel={() => setEditingPromo(null)}
                        />
                      </div>
                    ) : (
                      <>
                        <code className="text-xs font-mono font-semibold text-slate-900 bg-slate-50 px-2 py-1 rounded">
                          {promo.code}
                        </code>
                        <span className="text-xs text-slate-500">
                          {promo.percentOff ? `${promo.percentOff}% off` : `$${((promo.amountOff ?? 0) / 100).toFixed(2)} off`}
                        </span>
                        <span className="text-xs text-slate-400">
                          Used {promo.usedCount}{promo.maxUses ? `/${promo.maxUses}` : ''}
                        </span>
                        <div className="ml-auto flex items-center gap-1">
                          <button
                            onClick={() => setEditingPromo(promo.code)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeletePromo(promo.code)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add promo form */}
            {showAddPromo && (
              <PromoCodeEditor
                onSave={handleSavePromo}
                onCancel={() => setShowAddPromo(false)}
              />
            )}

            {(config?.discountCodes ?? []).length === 0 && !showAddPromo && (
              <p className="text-xs text-slate-400">No promo codes yet. Add one to offer discounts.</p>
            )}
          </section>
        )}

        {/* ── Event Connection ─────────────────────────────────────────── */}
        {ticketTypes.length > 0 && (
          <section className="border-t border-slate-100 pt-5">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-slate-400" />
              Event Connection
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Link this form to an event to show event date and venue on tickets and confirmation emails.
            </p>
            <p className="text-xs text-slate-400 italic">
              {"To link, go to the event's Registration tab and select this form — or use the Share tab."}
            </p>
          </section>
        )}

        {/* ── Sales Dashboard ─────────────────────────────────────────── */}
        {ticketTypes.length > 0 && (
          <OrdersDashboard formId={formDefinitionId} />
        )}
      </div>
    </div>
  )
}

// ─── Orders Dashboard (inline in Tickets tab) ────────────────────────────

interface OrderSummary {
  totalRevenue: number
  totalOrders: number
  totalTicketsSold: number
  totalCapacity: number | null
  checkedIn: number
}

interface TicketTypeSummary {
  id: string
  name: string
  price: number
  sold: number
  total: number | null
  revenue: number
}

interface OrderItem {
  id: string
  buyerName: string
  buyerEmail: string
  status: string
  paymentStatus: string
  total: number
  discountCode: string | null
  discountAmount: number
  createdAt: string
  paidAt: string | null
  ticketCount: number
  lineItems: Array<{
    ticketTypeName: string
    quantity: number
    unitPrice: number
    subtotal: number
  }>
}

interface OrdersData {
  summary: OrderSummary
  ticketTypes: TicketTypeSummary[]
  orders: OrderItem[]
}

function OrdersDashboard({ formId }: { formId: string }) {
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)

  const { data, isLoading } = useQuery<OrdersData>({
    queryKey: ['forms', formId, 'orders'],
    queryFn: () => fetchApi<OrdersData>(`/api/forms/${formId}/orders`),
    staleTime: 15_000,
  })

  if (isLoading) {
    return (
      <section className="border-t border-slate-100 pt-5 space-y-3 animate-pulse">
        <div className="h-4 w-32 bg-slate-100 rounded" />
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 bg-slate-100 rounded-xl" />
          ))}
        </div>
      </section>
    )
  }

  if (!data) return null

  const { summary, ticketTypes: ttSummary, orders } = data

  return (
    <section className="border-t border-slate-100 pt-5 space-y-4">
      <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
        <DollarSign className="w-4 h-4 text-emerald-500" />
        Sales
      </h3>

      {/* Summary row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2.5">
          <span className="text-[11px] text-slate-500">Revenue</span>
          <p className="text-sm font-bold text-slate-900">${(summary.totalRevenue / 100).toFixed(2)}</p>
        </div>
        <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2.5">
          <span className="text-[11px] text-slate-500">Tickets Sold</span>
          <p className="text-sm font-bold text-slate-900">
            {summary.totalTicketsSold}
            {summary.totalCapacity != null && (
              <span className="text-xs font-normal text-slate-400"> / {summary.totalCapacity}</span>
            )}
          </p>
        </div>
        <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2.5">
          <span className="text-[11px] text-slate-500">Orders</span>
          <p className="text-sm font-bold text-slate-900">{summary.totalOrders}</p>
        </div>
        <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2.5">
          <span className="text-[11px] text-slate-500">Checked In</span>
          <p className="text-sm font-bold text-slate-900">{summary.checkedIn}</p>
        </div>
      </div>

      {/* Ticket type breakdown */}
      {ttSummary.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500">
                <th className="text-left px-3 py-2 font-medium">Type</th>
                <th className="text-right px-3 py-2 font-medium">Sold</th>
                <th className="text-right px-3 py-2 font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {ttSummary.map((tt) => (
                <tr key={tt.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-3 py-2 text-slate-900 font-medium">{tt.name}</td>
                  <td className="px-3 py-2 text-right text-slate-600">
                    {tt.sold}{tt.total != null ? `/${tt.total}` : ''}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-900 font-medium">
                    ${(tt.revenue / 100).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent orders */}
      {orders.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">
              Recent Orders ({orders.length})
            </span>
            <button
              onClick={() => window.open(`/api/forms/${formId}/submissions/export`, '_blank')}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-md transition-colors cursor-pointer"
            >
              <Download className="w-3 h-3" />
              Export
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {orders.slice(0, 10).map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-slate-900 truncate">{order.buyerName}</span>
                    {order.paymentStatus === 'PAID' ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                    ) : order.status === 'CANCELLED' ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {order.lineItems.map((li) => `${li.quantity}× ${li.ticketTypeName}`).join(', ')}
                  </p>
                </div>
                <span className="text-xs font-medium text-slate-900">
                  ${(order.total / 100).toFixed(2)}
                </span>
                <ChevronRight className={`w-3.5 h-3.5 text-slate-300 flex-shrink-0 transition-transform ${expandedOrderId === order.id ? 'rotate-90' : ''}`} />
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
