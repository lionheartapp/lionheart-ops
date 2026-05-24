'use client'

import { useState, useRef, useImperativeHandle, forwardRef, useEffect } from 'react'
import { Plus, Trash2, MapPin, Pencil, Check, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { INVENTORY_CATEGORIES } from '@/lib/constants/inventory'
import { useCampusLocations, type CampusLocationOption } from '@/lib/hooks/useCampusLocations'
import { fetchApi } from '@/lib/api-client'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface LocationEntry {
  id: string
  quantity: number
  locationId: string | null
  locationName: string
  usage: string
}

interface UserOption {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
}

export interface StepEssentialsHandle {
  /** Commit the pending "add location" row if it has a quantity > 0 */
  flushPendingLocation: () => void
}

interface StepEssentialsProps {
  name: string
  description: string
  ownerId: string | null
  locations: LocationEntry[]
  allowCheckout: boolean
  category: string
  onNameChange: (v: string) => void
  onDescriptionChange: (v: string) => void
  onOwnerChange: (v: string | null) => void
  onLocationsChange: (v: LocationEntry[]) => void
  onCheckoutChange: (v: boolean) => void
  onCategoryChange: (v: string) => void
  nameError?: string
}

// ─── Component ─────────────────────────────────────────────────────────────

const StepEssentials = forwardRef<StepEssentialsHandle, StepEssentialsProps>(function StepEssentials({
  name,
  description,
  ownerId,
  locations,
  allowCheckout,
  category,
  onNameChange,
  onDescriptionChange,
  onOwnerChange,
  onLocationsChange,
  onCheckoutChange,
  onCategoryChange,
  nameError,
}, ref) {
  // Local state for the "add location" row
  const [newQty, setNewQty] = useState('1')
  const [newLocationId, setNewLocationId] = useState('')
  const [newUsage, setNewUsage] = useState('')
  const [locationSearch, setLocationSearch] = useState('')
  const [showLocationDropdown, setShowLocationDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Editing state for existing locations
  const [editingLocId, setEditingLocId] = useState<string | null>(null)
  const [editQty, setEditQty] = useState('')
  const [editLocationId, setEditLocationId] = useState('')
  const [editLocationSearch, setEditLocationSearch] = useState('')
  const [editUsage, setEditUsage] = useState('')
  const [showEditLocationDropdown, setShowEditLocationDropdown] = useState(false)
  const editDropdownRef = useRef<HTMLDivElement>(null)

  // Fetch users for owner dropdown
  const { data: users = [] } = useQuery<UserOption[]>({
    queryKey: ['org-users-for-owner'],
    queryFn: () => fetchApi('/api/settings/users').then((d: any) => d.users || d || []),
    staleTime: 300_000,
  })

  // Fetch campus locations
  const { data: campusLocations = [] } = useCampusLocations()

  // Filter locations for search
  const filteredLocations = campusLocations.filter((loc) =>
    loc.label.toLowerCase().includes(locationSearch.toLowerCase())
  )

  const selectedLocation = campusLocations.find(
    (loc) => (loc.roomId || loc.areaId || loc.buildingId) === newLocationId
  )

  const handleAddLocation = () => {
    const qty = parseInt(newQty, 10)
    if (!qty || qty < 1) return

    let locName = 'Unassigned'
    let locId: string | null = null

    if (selectedLocation) {
      locName = selectedLocation.hierarchy?.join(' › ') || selectedLocation.label
      locId = selectedLocation.roomId || selectedLocation.areaId || selectedLocation.buildingId
    }

    const newEntry: LocationEntry = {
      id: crypto.randomUUID(),
      quantity: qty,
      locationId: locId,
      locationName: locName,
      usage: newUsage.trim(),
    }

    onLocationsChange([...locations, newEntry])
    setNewQty('1')
    setNewLocationId('')
    setNewUsage('')
    setLocationSearch('')
  }

  const handleRemoveLocation = (id: string) => {
    onLocationsChange(locations.filter((l) => l.id !== id))
  }

  const startEditLocation = (loc: LocationEntry) => {
    setEditingLocId(loc.id)
    setEditQty(String(loc.quantity))
    setEditLocationId(loc.locationId || '')
    setEditLocationSearch(loc.locationName)
    setEditUsage(loc.usage)
    setShowEditLocationDropdown(false)
  }

  const cancelEditLocation = () => {
    setEditingLocId(null)
    setShowEditLocationDropdown(false)
  }

  const saveEditLocation = () => {
    if (!editingLocId) return
    const qty = parseInt(editQty, 10)
    if (!qty || qty < 1) return

    const editSelectedLoc = campusLocations.find(
      (loc) => (loc.roomId || loc.areaId || loc.buildingId) === editLocationId
    )

    let locName = editLocationSearch || 'Unassigned'
    let locId: string | null = editLocationId || null

    if (editSelectedLoc) {
      locName = editSelectedLoc.hierarchy?.join(' › ') || editSelectedLoc.label
      locId = editSelectedLoc.roomId || editSelectedLoc.areaId || editSelectedLoc.buildingId
    }

    onLocationsChange(
      locations.map((l) =>
        l.id === editingLocId
          ? { ...l, quantity: qty, locationId: locId, locationName: locName, usage: editUsage.trim() }
          : l
      )
    )
    setEditingLocId(null)
    setShowEditLocationDropdown(false)
  }

  const handleSelectEditLocation = (loc: CampusLocationOption) => {
    const id = loc.roomId || loc.areaId || loc.buildingId || ''
    setEditLocationId(id)
    setEditLocationSearch(loc.hierarchy?.join(' › ') || loc.label)
    setShowEditLocationDropdown(false)
  }

  // Filter locations for edit search
  const filteredEditLocations = campusLocations.filter((loc) =>
    loc.label.toLowerCase().includes(editLocationSearch.toLowerCase())
  )

  // Close edit dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (editDropdownRef.current && !editDropdownRef.current.contains(e.target as Node)) {
        setShowEditLocationDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSelectLocation = (loc: CampusLocationOption) => {
    const id = loc.roomId || loc.areaId || loc.buildingId || ''
    setNewLocationId(id)
    setLocationSearch(loc.hierarchy?.join(' › ') || loc.label)
    setShowLocationDropdown(false)
  }

  // Expose flushPendingLocation so the parent wizard can auto-commit
  // whatever the user typed before advancing steps
  useImperativeHandle(ref, () => ({
    flushPendingLocation: () => {
      const qty = parseInt(newQty, 10)
      if (!qty || qty < 1) return

      let locName = 'Unassigned'
      let locId: string | null = null
      if (selectedLocation) {
        locName = selectedLocation.hierarchy?.join(' › ') || selectedLocation.label
        locId = selectedLocation.roomId || selectedLocation.areaId || selectedLocation.buildingId
      }

      const entry: LocationEntry = {
        id: crypto.randomUUID(),
        quantity: qty,
        locationId: locId,
        locationName: locName,
        usage: newUsage.trim(),
      }

      onLocationsChange([...locations, entry])
      setNewQty('1')
      setNewLocationId('')
      setNewUsage('')
      setLocationSearch('')
    },
  }), [newQty, selectedLocation, newUsage, locations, onLocationsChange])

  const totalQuantity = locations.reduce((sum, loc) => sum + loc.quantity, 0)

  return (
    <div className="space-y-8">
      {/* ── Basic Information ── */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">Basic information</h3>

        {/* Name */}
        <div>
          <label htmlFor="av-name" className="block text-sm font-medium text-slate-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <Input
            id="av-name"
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            hasError={!!nameError}
            className={nameError ? 'bg-red-50' : ''}
            placeholder="e.g., LED Par Light"
          />
          {nameError && <p className="mt-1 text-xs text-red-600">{nameError}</p>}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="av-desc" className="block text-sm font-medium text-slate-700 mb-1">
            Description
          </label>
          <Textarea
            id="av-desc"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            rows={3}
            placeholder="Describe the equipment..."
          />
        </div>

        {/* Owner */}
        <div>
          <label htmlFor="av-owner" className="block text-sm font-medium text-slate-700 mb-1">
            Owner
          </label>
          <p className="text-xs text-slate-500 mb-1.5">
            Receives an email when someone requests to check out this equipment.
          </p>
          <Select
            value={ownerId ?? ''}
            onChange={(value) => onOwnerChange(value || null)}
            options={[
              { value: '', label: 'Select owner' },
              ...users.map((u) => ({
                value: u.id,
                label: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
                subtitle: u.email,
              })),
            ]}
          />
        </div>
      </section>

      {/* ── Inventory & Locations ── */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Inventory &amp; locations</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Add items by quantity, location, and usage. Total quantity is calculated automatically.
          </p>
        </div>

        {/* Existing location rows */}
        {locations.length > 0 && (
          <div className="space-y-2">
            {locations.map((loc) =>
              editingLocId === loc.id ? (
                /* ── Inline edit form ── */
                <div
                  key={loc.id}
                  className="px-4 py-3 bg-indigo-50 rounded-lg border border-indigo-200 space-y-3"
                >
                  <div className="grid grid-cols-[80px_1fr] gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Qty</label>
                      <Input
                        type="number"
                        min="1"
                        value={editQty}
                        onChange={(e) => setEditQty(e.target.value)}
                        size="sm"
                      />
                    </div>
                    <div className="relative" ref={editDropdownRef}>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Location</label>
                      <Input
                        type="text"
                        value={editLocationSearch}
                        onChange={(e) => {
                          setEditLocationSearch(e.target.value)
                          setShowEditLocationDropdown(true)
                          setEditLocationId('')
                        }}
                        onFocus={() => setShowEditLocationDropdown(true)}
                        placeholder="Select or type location"
                        size="sm"
                      />
                      {showEditLocationDropdown && filteredEditLocations.length > 0 && (
                        <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
                          {filteredEditLocations.map((l) => {
                            const id = l.roomId || l.areaId || l.buildingId || ''
                            return (
                              <button
                                key={id}
                                type="button"
                                onClick={() => handleSelectEditLocation(l)}
                                className="w-full px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors cursor-pointer"
                              >
                                <span className="text-slate-900">
                                  {l.hierarchy?.join(' › ') || l.label}
                                </span>
                                <span className="ml-2 text-xs text-slate-400 capitalize">{l.type}</span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Usage</label>
                    <Input
                      type="text"
                      value={editUsage}
                      onChange={(e) => setEditUsage(e.target.value)}
                      placeholder="e.g., For basketball games"
                      size="sm"
                    />
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      type="button"
                      onClick={cancelEditLocation}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                    <button
                      type="button"
                      onClick={saveEditLocation}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" /> Save
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Read-only card ── */
                <div
                  key={loc.id}
                  className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors cursor-pointer group"
                  onClick={() => startEditLocation(loc)}
                >
                  <span className="text-sm font-medium text-slate-900 min-w-[2.5rem]">
                    {loc.quantity}×
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-900 truncate flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      {loc.locationName}
                    </p>
                    {loc.usage && (
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{loc.usage}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      startEditLocation(loc)
                    }}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                    aria-label="Edit location"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveLocation(loc.id)
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                    aria-label="Remove location"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )
            )}
          </div>
        )}

        {/* Add location row */}
        <div className="grid grid-cols-[80px_1fr_1fr_40px] gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Quantity</label>
            <Input
              type="number"
              min="1"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              size="sm"
            />
          </div>
          <div className="relative" ref={dropdownRef}>
            <label className="block text-xs font-medium text-slate-600 mb-1">Location</label>
            <Input
              type="text"
              value={locationSearch}
              onChange={(e) => {
                setLocationSearch(e.target.value)
                setShowLocationDropdown(true)
                setNewLocationId('')
              }}
              onFocus={() => setShowLocationDropdown(true)}
              placeholder="Select or type location"
              size="sm"
            />
            {showLocationDropdown && filteredLocations.length > 0 && (
              <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
                {filteredLocations.map((loc) => {
                  const id = loc.roomId || loc.areaId || loc.buildingId || ''
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleSelectLocation(loc)}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <span className="text-slate-900">
                        {loc.hierarchy?.join(' › ') || loc.label}
                      </span>
                      <span className="ml-2 text-xs text-slate-400 capitalize">{loc.type}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Usage</label>
            <Input
              type="text"
              value={newUsage}
              onChange={(e) => setNewUsage(e.target.value)}
              placeholder="e.g., For basketball games"
              size="sm"
            />
          </div>
          <button
            type="button"
            onClick={handleAddLocation}
            className="h-[38px] w-[38px] flex items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer flex-shrink-0"
            aria-label="Add location"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Total quantity */}
        <p className="text-sm text-slate-600">
          Total Quantity: <span className="font-semibold text-slate-900">{totalQuantity}</span>
        </p>
      </section>

      {/* ── Checkout ── */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">Checkout</h3>

        <Checkbox
          checked={allowCheckout}
          onChange={(e) => onCheckoutChange(e.target.checked)}
          label="Allow staff to checkout"
        />

        <div>
          <label htmlFor="av-category" className="block text-sm font-medium text-slate-700 mb-1">
            Category
          </label>
          <Select
            value={category}
            onChange={onCategoryChange}
            options={[
              { value: '', label: 'None' },
              ...INVENTORY_CATEGORIES.map((cat) => ({ value: cat, label: cat })),
            ]}
          />
        </div>
      </section>
    </div>
  )
})

export default StepEssentials
