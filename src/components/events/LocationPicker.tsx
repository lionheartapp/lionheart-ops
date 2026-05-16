'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { MapPin, Building2, DoorOpen, Loader2, Navigation, TreePine } from 'lucide-react'
import { logger } from '@/lib/logger'
import { Input } from '@/components/ui/Input'
import { SearchInput } from '@/components/ui/SearchInput'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LocationData {
  isOffCampus: boolean
  // On-campus fields
  buildingId: string | null
  areaId: string | null
  roomId: string | null
  locationText: string // Descriptive text (auto-generated from selection)
  // Off-campus fields
  venueName: string
  venueAddress: string
  venuePlaceId: string
}

interface LocationPickerProps {
  value: LocationData
  onChange: (data: LocationData) => void
  error?: string
}

interface PlaceSuggestion {
  placeId: string
  description: string
  mainText: string
  secondaryText: string
}

interface BuildingRaw {
  id: string
  name: string
  rooms: RoomRaw[]
  areas: AreaRaw[]
  /** True when this entry is actually an unassigned space, not a building */
  isSpace?: boolean
  /** Parent group label for structured dropdown */
  groupLabel?: string
}

interface LocationGroup {
  label: string
  items: BuildingRaw[]
}

interface AreaRaw {
  id: string
  name: string
  rooms: RoomRaw[]
}

interface RoomRaw {
  id: string
  roomNumber: string | null
  displayName: string | null
  floor: string | null
  areaId?: string | null
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

function usePlacesAutocomplete(query: string) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!query || query.length < 3) {
      setSuggestions([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(query)}`)
        const json = await res.json()
        if (json.ok && Array.isArray(json.data)) {
          setSuggestions(json.data)
        } else {
          setSuggestions([])
        }
      } catch (error: unknown) {
        logger.error({ error: String(error) }, 'Places autocomplete fetch failed:')
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  return { suggestions, loading }
}

function useCampusBuildings() {
  const [buildings, setBuildings] = useState<BuildingRaw[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch_() {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
        const res = await fetch('/api/campus/lookup', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        const json = await res.json()
        if (json.ok) {
          // Attach parent group label to each building
          const rawBuildings: BuildingRaw[] = (json.data.buildings ?? []).map(
            (b: Record<string, unknown>) => ({
              ...b,
              areas: b.areas ?? b.spaces ?? [],
              rooms: b.rooms ?? [],
              groupLabel:
                (b.campus as { name?: string } | null)?.name ??
                (b.school as { name?: string } | null)?.name ??
                (b.district as { name?: string } | null)?.name ??
                'General',
            })
          )

          // Merge unassigned spaces (outdoor areas, hubs, etc.)
          const unassignedSpaces = json.data.unassignedSpaces ?? json.data.unassignedAreas ?? []
          const spacesAsBuildings: BuildingRaw[] = unassignedSpaces.map(
            (s: { id: string; name: string; rooms?: RoomRaw[] }) => ({
              id: s.id,
              name: s.name,
              rooms: s.rooms ?? [],
              areas: [],
              isSpace: true,
              groupLabel: 'Outdoor & Spaces',
            })
          )

          setBuildings([...rawBuildings, ...spacesAsBuildings])
        }
      } catch (error: unknown) {
        logger.error({ error: String(error) }, 'Failed to fetch campus buildings:')
      } finally {
        setLoading(false)
      }
    }
    fetch_()
  }, [])

  return { buildings, loading }
}

/** Group buildings by their parent label, preserving order. */
function groupBuildings(items: BuildingRaw[]): LocationGroup[] {
  const map = new Map<string, BuildingRaw[]>()
  for (const b of items) {
    const label = b.groupLabel ?? 'General'
    const existing = map.get(label) ?? []
    existing.push(b)
    map.set(label, existing)
  }
  return Array.from(map.entries()).map(([label, groupItems]) => ({ label, items: groupItems }))
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function LocationPicker({ value, onChange, error }: LocationPickerProps) {
  const { buildings, loading: buildingsLoading } = useCampusBuildings()

  // Off-campus search state
  const [addressQuery, setAddressQuery] = useState(value.venueAddress || '')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const { suggestions, loading: placesLoading } = usePlacesAutocomplete(addressQuery)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Building search state
  const [buildingSearch, setBuildingSearch] = useState('')
  const [showBuildingDropdown, setShowBuildingDropdown] = useState(false)
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const buildingDropdownRef = useRef<HTMLDivElement>(null)

  // Room search state
  const [roomSearch, setRoomSearch] = useState('')
  const [showRoomDropdown, setShowRoomDropdown] = useState(false)
  const roomDropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
      if (buildingDropdownRef.current && !buildingDropdownRef.current.contains(e.target as Node)) {
        setShowBuildingDropdown(false)
      }
      if (roomDropdownRef.current && !roomDropdownRef.current.contains(e.target as Node)) {
        setShowRoomDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Derive selected building and its rooms
  const selectedBuilding = buildings.find((b) => b.id === value.buildingId) ?? null
  const availableRooms: RoomRaw[] = selectedBuilding
    ? [
        ...(selectedBuilding.rooms ?? []),
        ...(selectedBuilding.areas?.flatMap((a) => a.rooms ?? []) ?? []),
      ]
    : []
  const selectedRoom = availableRooms.find((r) => r.id === value.roomId) ?? null

  // All groups (unfiltered) for tab labels
  const allGroups = groupBuildings(buildings)

  // Filter buildings by search + active tab
  const filteredBuildings = buildings.filter((b) => {
    if (buildingSearch && !b.name.toLowerCase().includes(buildingSearch.toLowerCase())) return false
    if (activeTab && (b.groupLabel ?? 'General') !== activeTab) return false
    return true
  })

  // Filter rooms by search
  const filteredRooms = roomSearch
    ? availableRooms.filter((r) => {
        const label = r.displayName || r.roomNumber || ''
        return label.toLowerCase().includes(roomSearch.toLowerCase())
      })
    : availableRooms

  // Auto-fill room if building has exactly 1 room
  useEffect(() => {
    if (selectedBuilding && availableRooms.length === 1 && !value.roomId) {
      const room = availableRooms[0]
      const roomLabel = room.displayName || room.roomNumber || 'Room'
      onChange({
        ...value,
        roomId: room.id,
        locationText: `${selectedBuilding.name} — ${roomLabel}`,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBuilding?.id, availableRooms.length])

  const handleToggle = useCallback(() => {
    onChange({
      isOffCampus: !value.isOffCampus,
      buildingId: null,
      areaId: null,
      roomId: null,
      locationText: '',
      venueName: '',
      venueAddress: '',
      venuePlaceId: '',
    })
    setAddressQuery('')
    setBuildingSearch('')
    setRoomSearch('')
  }, [value.isOffCampus, onChange])

  const handleSelectBuilding = (building: BuildingRaw) => {
    setShowBuildingDropdown(false)
    setBuildingSearch('')
    setRoomSearch('')

    // Get all rooms for this building
    const allRooms = [
      ...(building.rooms ?? []),
      ...(building.areas?.flatMap((a) => a.rooms ?? []) ?? []),
    ]

    if (allRooms.length === 1) {
      // Auto-fill room
      const room = allRooms[0]
      const roomLabel = room.displayName || room.roomNumber || 'Room'
      onChange({
        ...value,
        buildingId: building.id,
        areaId: room.areaId || null,
        roomId: room.id,
        locationText: `${building.name} — ${roomLabel}`,
      })
    } else {
      onChange({
        ...value,
        buildingId: building.id,
        areaId: null,
        roomId: null,
        locationText: building.name,
      })
    }
  }

  const handleSelectRoom = (room: RoomRaw) => {
    setShowRoomDropdown(false)
    setRoomSearch('')
    const roomLabel = room.displayName || room.roomNumber || 'Room'
    onChange({
      ...value,
      roomId: room.id,
      areaId: room.areaId || value.areaId,
      locationText: selectedBuilding
        ? `${selectedBuilding.name} — ${roomLabel}`
        : roomLabel,
    })
  }

  const handleSelectPlace = (place: PlaceSuggestion) => {
    setShowSuggestions(false)
    setAddressQuery(place.secondaryText || place.description)
    onChange({
      ...value,
      venueName: place.mainText,
      venueAddress: place.secondaryText || place.description,
      venuePlaceId: place.placeId,
      locationText: place.description,
    })
  }

  const getRoomLabel = (room: RoomRaw) =>
    room.displayName || room.roomNumber || `Room ${room.id.slice(-4)}`

  return (
    <div className="space-y-3">
      {/* Header + Toggle */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-slate-400" />
          Location
        </label>

        {/* Off Campus toggle */}
        <button
          type="button"
          onClick={handleToggle}
          className="flex items-center gap-2 cursor-pointer group"
        >
          <span className="text-xs text-slate-500 group-hover:text-slate-700 transition-colors">
            Off Campus
          </span>
          <div
            className={`relative w-9 h-5 rounded-full transition-colors ${
              value.isOffCampus ? 'bg-indigo-500' : 'bg-slate-200'
            }`}
          >
            <div
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                value.isOffCampus ? 'translate-x-[18px]' : 'translate-x-0.5'
              }`}
            />
          </div>
        </button>
      </div>

      {/* ON CAMPUS — Building + Room dropdowns */}
      {!value.isOffCampus && (
        <div className="space-y-2.5">
          {/* Building Selector */}
          <div ref={buildingDropdownRef} className="relative">
            <div
              className={`flex items-center gap-2 px-3 py-2.5 border rounded-xl cursor-pointer transition-colors ${
                showBuildingDropdown ? 'border-indigo-400 ring-2 ring-indigo-100' : error ? 'border-red-300' : 'border-slate-200 hover:border-slate-300'
              }`}
              onClick={() => setShowBuildingDropdown(!showBuildingDropdown)}
            >
              {selectedBuilding?.isSpace ? (
                <TreePine className="w-4 h-4 text-slate-400 flex-shrink-0" />
              ) : (
                <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
              )}
              {selectedBuilding ? (
                <span className="text-sm text-slate-900 flex-1">{selectedBuilding.name}</span>
              ) : (
                <span className="text-sm text-slate-400 flex-1">Select a location...</span>
              )}
              {buildingsLoading && <Loader2 className="w-3.5 h-3.5 text-slate-300 animate-spin" />}
            </div>

            {showBuildingDropdown && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                <div className="py-1 max-h-72 overflow-y-auto">
                  {/* Category pill tabs */}
                  {allGroups.length > 1 && (
                    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-slate-100 mb-1">
                      <button
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); setActiveTab(null) }}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                          activeTab === null
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        All
                      </button>
                      {allGroups.map((g) => (
                        <button
                          key={g.label}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); setActiveTab(g.label) }}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                            activeTab === g.label
                              ? 'bg-slate-900 text-white'
                              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {g.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Items */}
                  {filteredBuildings.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-slate-400 text-center">No locations found</p>
                  ) : (
                    filteredBuildings.map((b) => {
                      const totalRooms = (b.rooms?.length ?? 0) + (b.areas?.reduce((sum, a) => sum + (a.rooms?.length ?? 0), 0) ?? 0)
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => handleSelectBuilding(b)}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors cursor-pointer ${
                            value.buildingId === b.id ? 'bg-slate-100' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                            b.isSpace ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {b.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{b.name}</p>
                            <p className="text-[10px] text-slate-400">{b.isSpace ? 'Space' : 'Building'}</p>
                          </div>
                          {totalRooms > 0 && (
                            <span className="text-[10px] text-slate-300 flex-shrink-0">
                              {totalRooms} room{totalRooms === 1 ? '' : 's'}
                            </span>
                          )}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Room Selector — only shown if building is selected and has rooms */}
          {selectedBuilding && availableRooms.length > 1 && (
            <div ref={roomDropdownRef} className="relative">
              <div
                className={`flex items-center gap-2 px-3 py-2.5 border rounded-xl cursor-pointer transition-colors ${
                  showRoomDropdown ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-slate-300'
                }`}
                onClick={() => setShowRoomDropdown(!showRoomDropdown)}
              >
                <DoorOpen className="w-4 h-4 text-slate-400 flex-shrink-0" />
                {selectedRoom ? (
                  <span className="text-sm text-slate-900 flex-1">{getRoomLabel(selectedRoom)}</span>
                ) : (
                  <span className="text-sm text-slate-400 flex-1">Select a room...</span>
                )}
              </div>

              {showRoomDropdown && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-hidden">
                  {availableRooms.length > 5 && (
                    <div className="px-3 py-2 border-b border-slate-100">
                      <SearchInput
                        size="sm"
                        value={roomSearch}
                        onChange={(e) => setRoomSearch(e.target.value)}
                        placeholder="Search rooms..."
                        autoFocus
                      />
                    </div>
                  )}
                  <div className="overflow-y-auto max-h-44">
                    {filteredRooms.length === 0 ? (
                      <p className="px-4 py-3 text-xs text-slate-400 text-center">No rooms found</p>
                    ) : (
                      filteredRooms.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => handleSelectRoom(r)}
                          className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors cursor-pointer ${
                            value.roomId === r.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'
                          }`}
                        >
                          {getRoomLabel(r)}
                          {r.floor && <span className="text-xs text-slate-400 ml-2">Floor {r.floor}</span>}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Single room auto-filled indicator */}
          {selectedBuilding && availableRooms.length === 1 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl">
              <DoorOpen className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs text-slate-600">{getRoomLabel(availableRooms[0])}</span>
              <span className="text-[10px] text-slate-400">(only room)</span>
            </div>
          )}

          {/* No rooms indicator */}
          {selectedBuilding && availableRooms.length === 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl">
              <DoorOpen className="w-3.5 h-3.5 text-slate-300" />
              <span className="text-xs text-slate-400">No rooms configured for this building</span>
            </div>
          )}
        </div>
      )}

      {/* OFF CAMPUS — Google Places autocomplete */}
      {value.isOffCampus && (
        <div className="space-y-2.5">
          {/* Address search */}
          <div ref={suggestionsRef} className="relative">
            <div
              className={`flex items-center gap-2 px-3 py-2.5 border rounded-xl transition-colors ${
                showSuggestions && suggestions.length > 0
                  ? 'border-indigo-400 ring-2 ring-indigo-100'
                  : error ? 'border-red-300' : 'border-slate-200'
              }`}
            >
              <Navigation className="w-4 h-4 text-slate-400 flex-shrink-0" />
              {/* eslint-disable-next-line no-restricted-syntax -- bare typing surface inside a custom-styled wrapper with autocomplete suggestions; SearchInput's magnifying-glass icon doesn't fit (we use Navigation here for an address picker) */}
              <input
                type="text"
                value={addressQuery}
                onChange={(e) => {
                  setAddressQuery(e.target.value)
                  setShowSuggestions(true)
                  // Clear previous selection if typing new
                  if (value.venuePlaceId) {
                    onChange({ ...value, venueName: '', venueAddress: '', venuePlaceId: '', locationText: '' })
                  }
                }}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                placeholder="Search for a venue or address..."
                className="bg-transparent text-sm text-slate-900 outline-none flex-1 placeholder:text-slate-400"
              />
              {placesLoading && <Loader2 className="w-3.5 h-3.5 text-slate-300 animate-spin" />}
            </div>

            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                {suggestions.map((s) => (
                  <button
                    key={s.placeId}
                    type="button"
                    onClick={() => handleSelectPlace(s)}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-50 last:border-b-0"
                  >
                    <p className="text-sm font-medium text-slate-900">{s.mainText}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.secondaryText}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Venue name — auto-filled from Google or manual entry */}
          {(value.venuePlaceId || addressQuery.length >= 3) && (
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Venue / Location Name</label>
              <Input
                value={value.venueName}
                onChange={(e) => onChange({ ...value, venueName: e.target.value })}
                placeholder="e.g. City Convention Center"
              />
            </div>
          )}

          {/* Selected address confirmation */}
          {value.venuePlaceId && value.venueAddress && (
            <div className="flex items-start gap-2 px-3 py-2 bg-green-50 border border-green-100 rounded-xl">
              <MapPin className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                {value.venueName && (
                  <p className="text-xs font-semibold text-green-800">{value.venueName}</p>
                )}
                <p className="text-xs text-green-700">{value.venueAddress}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

// ─── Default value helper ───────────────────────────────────────────────────

export function defaultLocationData(): LocationData {
  return {
    isOffCampus: false,
    buildingId: null,
    areaId: null,
    roomId: null,
    locationText: '',
    venueName: '',
    venueAddress: '',
    venuePlaceId: '',
  }
}
