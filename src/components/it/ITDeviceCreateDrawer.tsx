'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queries'
import { getAuthHeaders } from '@/lib/api-client'
import DetailDrawer from '@/components/DetailDrawer'
import { FloatingInput, FloatingTextarea } from '@/components/ui/FloatingInput'
import { useToast } from '@/components/Toast'
import { Loader2 } from 'lucide-react'

interface ITDeviceCreateDrawerProps {
  isOpen: boolean
  onClose: () => void
}

interface Building {
  id: string
  name: string
  areas?: Area[]
  rooms?: Room[]
}

interface Area {
  id: string
  name: string
  rooms?: Room[]
}

interface Room {
  id: string
  roomNumber?: string
  displayName?: string | null
}

interface School {
  id: string
  name: string
}

const DEVICE_TYPES = [
  { value: 'CHROMEBOOK', label: 'Chromebook' },
  { value: 'LAPTOP', label: 'Laptop' },
  { value: 'TABLET', label: 'Tablet' },
  { value: 'DESKTOP', label: 'Desktop' },
  { value: 'MONITOR', label: 'Monitor' },
  { value: 'PRINTER', label: 'Printer' },
  { value: 'OTHER', label: 'Other' },
]

const STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'REPAIR', label: 'In Repair' },
  { value: 'LOANER', label: 'Loaner' },
  { value: 'RETIRED', label: 'Retired' },
  { value: 'LOST', label: 'Lost' },
  { value: 'DECOMMISSIONED', label: 'Decommissioned' },
]

export default function ITDeviceCreateDrawer({ isOpen, onClose }: ITDeviceCreateDrawerProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [deviceType, setDeviceType] = useState('CHROMEBOOK')
  const [serialNumber, setSerialNumber] = useState('')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [status, setStatus] = useState('ACTIVE')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [warrantyExpiry, setWarrantyExpiry] = useState('')
  const [schoolId, setSchoolId] = useState('')
  const [buildingId, setBuildingId] = useState('')
  const [areaId, setAreaId] = useState('')
  const [roomId, setRoomId] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  // Fetch buildings
  const { data: buildings = [] } = useQuery<Building[]>({
    queryKey: ['campus-buildings-for-it-devices'],
    queryFn: async () => {
      const res = await fetch('/api/settings/campus/buildings', { headers: getAuthHeaders() })
      if (!res.ok) return []
      const data = await res.json()
      return data.ok ? data.data : []
    },
    staleTime: 5 * 60_000,
  })

  // Fetch schools
  const { data: schools = [] } = useQuery<School[]>({
    queryKey: ['schools-for-it-device-create'],
    queryFn: async () => {
      const res = await fetch('/api/settings/schools', { headers: getAuthHeaders() })
      if (!res.ok) return []
      const data = await res.json()
      return data.ok ? data.data : []
    },
    staleTime: 5 * 60_000,
  })

  const selectedBuilding = buildings.find((b) => b.id === buildingId)
  const areas = selectedBuilding?.areas ?? []
  const selectedArea = areas.find((a) => a.id === areaId)
  const rooms = selectedArea?.rooms ?? selectedBuilding?.rooms ?? []

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { deviceType, status }
      if (serialNumber.trim()) body.serialNumber = serialNumber.trim()
      if (make.trim()) body.make = make.trim()
      if (model.trim()) body.model = model.trim()
      if (purchaseDate) body.purchaseDate = purchaseDate
      if (purchasePrice) body.purchasePrice = parseFloat(purchasePrice)
      if (warrantyExpiry) body.warrantyExpiry = warrantyExpiry
      if (schoolId) body.schoolId = schoolId
      if (buildingId) body.buildingId = buildingId
      if (roomId) body.roomId = roomId
      if (notes.trim()) body.notes = notes.trim()

      const res = await fetch('/api/it/devices', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error?.message || 'Failed to create device')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.itDevices.all })
      toast('Device added successfully', 'success')
      resetForm()
      onClose()
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  const resetForm = () => {
    setDeviceType('CHROMEBOOK')
    setSerialNumber('')
    setMake('')
    setModel('')
    setStatus('ACTIVE')
    setPurchaseDate('')
    setPurchasePrice('')
    setWarrantyExpiry('')
    setSchoolId('')
    setBuildingId('')
    setAreaId('')
    setRoomId('')
    setNotes('')
    setError('')
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  return (
    <DetailDrawer isOpen={isOpen} onClose={handleClose} title="Add Device" width="md">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          createMutation.mutate()
        }}
        className="px-6 py-4 space-y-4"
      >
        {/* Device Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Device Type *</label>
          <select
            value={deviceType}
            onChange={(e) => setDeviceType(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40 cursor-pointer"
          >
            {DEVICE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <FloatingInput
          label="Serial Number"
          value={serialNumber}
          onChange={(e) => setSerialNumber(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <FloatingInput
            label="Make"
            value={make}
            onChange={(e) => setMake(e.target.value)}
            placeholder="e.g. Dell, HP, Lenovo"
          />
          <FloatingInput
            label="Model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="e.g. Chromebook 3100"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40 cursor-pointer"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Purchase Info */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            />
          </div>
          <FloatingInput
            label="Purchase Price"
            type="number"
            step="0.01"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Warranty Expiry</label>
          <input
            type="date"
            value={warrantyExpiry}
            onChange={(e) => setWarrantyExpiry(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
          />
        </div>

        {/* Campus */}
        {schools.length > 1 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Campus</label>
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40 cursor-pointer"
            >
              <option value="">Select campus...</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Location */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Location (optional)</label>
          <select
            value={buildingId}
            onChange={(e) => { setBuildingId(e.target.value); setAreaId(''); setRoomId('') }}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40 cursor-pointer"
          >
            <option value="">Select building...</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          {areas.length > 0 && (
            <select
              value={areaId}
              onChange={(e) => { setAreaId(e.target.value); setRoomId('') }}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40 cursor-pointer"
            >
              <option value="">Select area...</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}

          {rooms.length > 0 && (
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40 cursor-pointer"
            >
              <option value="">Select room...</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.displayName || r.roomNumber || r.id}
                </option>
              ))}
            </select>
          )}
        </div>

        <FloatingTextarea
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Add Device
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="px-5 py-2.5 rounded-full bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 active:scale-[0.97] transition-all"
          >
            Cancel
          </button>
        </div>
      </form>
    </DetailDrawer>
  )
}
