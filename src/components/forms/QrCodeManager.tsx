'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  QrCode, Plus, Printer, ToggleLeft, ToggleRight,
  RefreshCw, Building2, MapPin, Tag, Loader2, X,
} from 'lucide-react'
import { fetchApi, getAuthHeaders } from '@/lib/api-client'
import { useToast } from '@/components/Toast'
import QRCode from 'qrcode'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

// ─── Types ────────────────────────────────────────────────────────────────────

interface QrCodeRecord {
  id: string
  categoryKey: string | null
  buildingId: string | null
  areaId: string | null
  roomId: string | null
  token: string
  label: string
  active: boolean
  createdAt: string
  lastUsedAt: string | null
  building?: { id: string; name: string } | null
  area?: { id: string; name: string } | null
  room?: { id: string; roomNumber: string; displayName: string | null } | null
}

interface BuildingOption {
  id: string
  name: string
  areas: Array<{
    id: string
    name: string
    rooms: Array<{ id: string; roomNumber: string; displayName: string | null }>
  }>
  rooms: Array<{ id: string; roomNumber: string; displayName: string | null }>
}

interface CampusLookupResponse {
  buildings: BuildingOption[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  { value: '', label: 'Any — user picks' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'software', label: 'Software' },
  { value: 'account_password', label: 'Account / Password' },
  { value: 'network', label: 'Network' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'custodial', label: 'Custodial' },
]

// ─── QR Card Component ────────────────────────────────────────────────────────

function QrCard({
  qr,
  appUrl,
  onToggle,
  onRegenerate,
}: {
  qr: QrCodeRecord
  appUrl: string
  onToggle: () => void
  onRegenerate: () => void
}) {
  const [svgData, setSvgData] = useState<string>('')
  const url = `${appUrl}/f/qr/${qr.token}`

  // Generate QR SVG
  useState(() => {
    QRCode.toString(url, { type: 'svg', width: 140, margin: 1 })
      .then(setSvgData)
      .catch(() => setSvgData(''))
  })

  return (
    <div
      className={`rounded-2xl border bg-white p-4 flex flex-col items-center text-center transition-all duration-200 ${
        qr.active
          ? 'border-[rgba(17,15,10,0.08)] hover:shadow-md'
          : 'border-[rgba(17,15,10,0.05)] opacity-60'
      }`}
    >
      {/* QR Image */}
      <div
        className="w-[140px] h-[140px] mb-3"
        dangerouslySetInnerHTML={{ __html: svgData }}
      />

      {/* Location */}
      {qr.building && (
        <div className="text-[10px] uppercase tracking-wider text-[#a8a49d]">
          {qr.building.name}
        </div>
      )}
      <div className="text-sm font-semibold text-[#1a1915] leading-tight">
        {qr.label}
      </div>
      {qr.categoryKey && (
        <div className="mt-1 text-[11px] text-blue-600 font-medium capitalize">
          {qr.categoryKey.replace(/_/g, ' ')}
        </div>
      )}

      {/* Status + actions */}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          className="text-[11px] cursor-pointer flex items-center gap-1 transition-colors duration-200 hover:text-[#1a1915]"
          title={qr.active ? 'Deactivate' : 'Activate'}
        >
          {qr.active ? (
            <ToggleRight className="w-4 h-4 text-green-500" />
          ) : (
            <ToggleLeft className="w-4 h-4 text-[#a8a49d]" />
          )}
          <span className={qr.active ? 'text-green-700' : 'text-[#a8a49d]'}>
            {qr.active ? 'Active' : 'Inactive'}
          </span>
        </button>
        <button
          type="button"
          onClick={onRegenerate}
          className="text-[11px] text-[#a8a49d] hover:text-orange-600 cursor-pointer flex items-center gap-1 transition-colors duration-200"
          title="Regenerate token"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      {/* Last used */}
      {qr.lastUsedAt && (
        <div className="mt-2 text-[10px] text-[#a8a49d]">
          Last scanned{' '}
          {new Date(qr.lastUsedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </div>
      )}

      {/* URL */}
      <div className="mt-2 text-[9px] text-[#a8a49d] font-mono break-all leading-tight max-w-full">
        {url.replace(/^https?:\/\//, '')}
      </div>
    </div>
  )
}

// ─── Create Drawer ────────────────────────────────────────────────────────────

function CreateQrDrawer({
  open,
  onClose,
  onCreated,
  buildings,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
  buildings: BuildingOption[]
}) {
  const [categoryKey, setCategoryKey] = useState('')
  const [buildingId, setBuildingId] = useState('')
  const [areaId, setAreaId] = useState('')
  const [roomId, setRoomId] = useState('')
  const [label, setLabel] = useState('')
  const [creating, setCreating] = useState(false)
  const safeBuildings = Array.isArray(buildings) ? buildings : []

  const selectedBuilding = safeBuildings.find((b) => b.id === buildingId)
  const areas = selectedBuilding?.areas ?? []
  const selectedArea = areas.find((a) => a.id === areaId)
  const rooms = selectedArea?.rooms ?? selectedBuilding?.rooms ?? []

  // Auto-generate label from selections
  function autoLabel() {
    const parts: string[] = []
    if (selectedBuilding) parts.push(selectedBuilding.name)
    const selectedRoom = rooms.find((r) => r.id === roomId)
    if (selectedRoom) parts.push(selectedRoom.displayName ?? selectedRoom.roomNumber)
    if (categoryKey) parts.push(`— ${categoryKey.replace(/_/g, ' ')}`)
    return parts.join(' ') || 'New QR Code'
  }

  async function handleCreate() {
    const finalLabel = label.trim() || autoLabel()
    if (!finalLabel) return
    setCreating(true)
    try {
      await fetch('/api/forms/qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          categoryKey: categoryKey || null,
          buildingId: buildingId || null,
          areaId: areaId || null,
          roomId: roomId || null,
          label: finalLabel,
        }),
      })
      onCreated()
      onClose()
      setCategoryKey('')
      setBuildingId('')
      setAreaId('')
      setRoomId('')
      setLabel('')
    } finally {
      setCreating(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-xl animate-[fadeIn_150ms_ease-out] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-[rgba(17,15,10,0.06)] px-6 py-4 flex items-center justify-between z-10">
          <h3 className="text-base font-semibold text-[#1a1915]">Create QR Code</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#a8a49d] hover:text-[#1a1915] hover:bg-[#f5f4f0] cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Category */}
          <div>
            <label className="text-xs font-medium text-[#6a6864] mb-1.5 block">
              <Tag className="w-3.5 h-3.5 inline mr-1" />
              Category
            </label>
            <Select
              value={categoryKey}
              onChange={setCategoryKey}
              options={CATEGORY_OPTIONS}
            />
            <p className="text-[11px] text-[#a8a49d] mt-1">
              Leave as &ldquo;Any&rdquo; if the scanner should pick the category.
            </p>
          </div>

          {/* Building */}
          <div>
            <label className="text-xs font-medium text-[#6a6864] mb-1.5 block">
              <Building2 className="w-3.5 h-3.5 inline mr-1" />
              Building
            </label>
            <Select
              value={buildingId}
              onChange={(value) => { setBuildingId(value); setAreaId(''); setRoomId('') }}
              options={[{ value: '', label: 'Optional' }, ...safeBuildings.map((b) => ({ value: b.id, label: b.name }))]}
            />
          </div>

          {/* Area */}
          {areas.length > 0 && (
            <div>
              <label className="text-xs font-medium text-[#6a6864] mb-1.5 block">
                Area / Wing
              </label>
              <Select
                value={areaId}
                onChange={(value) => { setAreaId(value); setRoomId('') }}
                options={[{ value: '', label: 'Optional' }, ...areas.map((a) => ({ value: a.id, label: a.name }))]}
              />
            </div>
          )}

          {/* Room */}
          {rooms.length > 0 && (
            <div>
              <label className="text-xs font-medium text-[#6a6864] mb-1.5 block">
                <MapPin className="w-3.5 h-3.5 inline mr-1" />
                Room
              </label>
              <Select
                value={roomId}
                onChange={setRoomId}
                options={[
                  { value: '', label: 'Optional' },
                  ...rooms.map((r) => ({ value: r.id, label: r.displayName ?? r.roomNumber })),
                ]}
              />
            </div>
          )}

          {/* Label */}
          <div>
            <label className="text-xs font-medium text-[#6a6864] mb-1.5 block">
              Label
            </label>
            <Input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={autoLabel() || 'e.g., Room 204 — IT'}
              className="w-full text-sm"
            />
            <p className="text-[11px] text-[#a8a49d] mt-1">
              Auto-generated from your selections if left blank.
            </p>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-[rgba(17,15,10,0.06)] px-6 py-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-full bg-white border border-[rgba(17,15,10,0.1)] text-sm font-medium text-[#6a6864] hover:bg-[#f5f4f0] cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="px-5 py-2.5 rounded-full bg-[#1a1915] text-white text-sm font-medium hover:bg-[#2a2925] active:scale-[0.97] cursor-pointer transition-all disabled:opacity-50"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create QR Code'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function QrCodeManager() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const appUrl = typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL ?? ''

  // Fetch QR codes
  const { data: qrCodes = [], isLoading } = useQuery({
    queryKey: ['form-qr-codes'],
    queryFn: () => fetchApi<QrCodeRecord[]>('/api/forms/qr'),
  })

  // Fetch buildings for the create drawer
  const { data: buildings = [] } = useQuery({
    queryKey: ['campus-buildings-for-qr'],
    queryFn: async () => {
      const data = await fetchApi<CampusLookupResponse>('/api/campus/lookup')
      return data.buildings
    },
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await fetch(`/api/forms/qr/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ active }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-qr-codes'] })
    },
  })

  const regenerateMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/forms/qr/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ regenerateToken: true }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-qr-codes'] })
      toast('Token regenerated — old QR codes will stop working', 'warning')
    },
  })

  function handlePrint() {
    window.print()
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-[#f5f4f0] rounded-xl animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-2xl bg-[#f5f4f0] animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 no-print">
        <div>
          <h3 className="text-lg font-semibold text-[#1a1915]">QR Codes</h3>
          <p className="text-sm text-[#6a6864] mt-0.5">
            Generate printable QR codes for quick ticket submission from any room.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#a8a49d]">
            {qrCodes.length} code{qrCodes.length === 1 ? '' : 's'}
          </span>
          {qrCodes.length > 0 && (
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-full bg-white border border-[rgba(17,15,10,0.1)] text-sm font-medium text-[#1a1915] hover:bg-[#f5f4f0] cursor-pointer transition-colors flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Print All
            </button>
          )}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="px-4 py-2 rounded-full bg-[#1a1915] text-white text-sm font-medium hover:bg-[#2a2925] active:scale-[0.97] cursor-pointer transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create QR Code
          </button>
        </div>
      </div>

      {/* QR Grid */}
      {qrCodes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[rgba(17,15,10,0.12)] bg-white py-12 text-center">
          <QrCode className="w-10 h-10 text-[#a8a49d] mx-auto mb-3" />
          <p className="text-sm font-medium text-[#1a1915] mb-1">No QR codes yet</p>
          <p className="text-sm text-[#a8a49d] mb-4 max-w-xs mx-auto">
            Create QR codes that teachers can scan from their classroom to submit tickets instantly.
          </p>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="px-5 py-2.5 rounded-full bg-[#1a1915] text-white text-sm font-medium hover:bg-[#2a2925] active:scale-[0.97] cursor-pointer transition-all"
          >
            Create First QR Code
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 print-sheet">
          {qrCodes.map((qr) => (
            <QrCard
              key={qr.id}
              qr={qr}
              appUrl={appUrl}
              onToggle={() =>
                toggleMutation.mutate({ id: qr.id, active: !qr.active })
              }
              onRegenerate={() => {
                if (
                  window.confirm(
                    'This will break all printed QR codes using this token. You\'ll need to reprint. Continue?'
                  )
                ) {
                  regenerateMutation.mutate(qr.id)
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Create drawer */}
      <CreateQrDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onCreated={() =>
          queryClient.invalidateQueries({ queryKey: ['form-qr-codes'] })
        }
        buildings={buildings as BuildingOption[]}
      />

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          .print-sheet {
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 12px !important;
          }
          .print-sheet > div {
            break-inside: avoid;
            page-break-inside: avoid;
            box-shadow: none !important;
            border: 1px solid #d1d5db !important;
          }
        }
      `}</style>
    </div>
  )
}
