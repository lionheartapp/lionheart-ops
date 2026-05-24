'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queries'
import { getAuthHeaders } from '@/lib/api-client'
import DetailDrawer from '@/components/DetailDrawer'
import { FloatingInput, FloatingTextarea } from '@/components/ui/FloatingInput'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
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
    <DetailDrawer
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Device"
      width="md"
      footer={
        <div className="flex gap-3">
          <button
            type="submit"
            form="it-device-create-form"
            disabled={createMutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Add Device
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="px-5 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 active:scale-[0.97] transition-all"
          >
            Cancel
          </button>
        </div>
      }
    >
      <form
        id="it-device-create-form"
        onSubmit={(e) => {
          e.preventDefault()
          createMutation.mutate()
        }}
        className="space-y-4"
      >
        {/* Device Type */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Device Type *</label>
          <Select
            value={deviceType}
            onChange={setDeviceType}
            options={DEVICE_TYPES}
          />
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
          <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
          <Select
            value={status}
            onChange={setStatus}
            options={STATUSES}
          />
        </div>

        {/* Purchase Info */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Purchase Date</label>
            <Input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
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
          <label className="block text-sm font-medium text-slate-700 mb-1">Warranty Expiry</label>
          <Input
            type="date"
            value={warrantyExpiry}
            onChange={(e) => setWarrantyExpiry(e.target.value)}
          />
        </div>

        {/* Campus */}
        {schools.length > 1 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Campus</label>
            <Select
              value={schoolId}
              onChange={setSchoolId}
              options={[
                { value: '', label: 'Select campus...' },
                ...schools.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </div>
        )}

        {/* Location */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">Location (optional)</label>
          <Select
            value={buildingId}
            onChange={(value) => { setBuildingId(value); setAreaId(''); setRoomId('') }}
            options={[
              { value: '', label: 'Select building...' },
              ...buildings.map((b) => ({ value: b.id, label: b.name })),
            ]}
          />

          {areas.length > 0 && (
            <Select
              value={areaId}
              onChange={(value) => { setAreaId(value); setRoomId('') }}
              options={[
                { value: '', label: 'Select area...' },
                ...areas.map((a) => ({ value: a.id, label: a.name })),
              ]}
            />
          )}

          {rooms.length > 0 && (
            <Select
              value={roomId}
              onChange={setRoomId}
              options={[
                { value: '', label: 'Select room...' },
                ...rooms.map((r) => ({ value: r.id, label: r.displayName || r.roomNumber || r.id })),
              ]}
            />
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

      </form>
    </DetailDrawer>
  )
}
