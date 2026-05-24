'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { MapPin, Building2, DoorOpen, Loader2, Navigation, TreePine, ChevronLeft, ChevronRight } from 'lucide-react'
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
  /** Filter spaces to specific types (e.g., ['FIELD', 'COURT', 'GYM'] for athletics) */
  spaceTypeFilter?: string[]
  /** Hide the off-campus toggle (e.g., when booking a facility, not a venue) */
  hideOffCampus?: boolean
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
  /** Space status (only for spaces, not buildings) */
  status?: 'ACTIVE' | 'UNDER_MAINTENANCE' | 'CLOSED'
  /** Space type (FIELD, COURT, GYM, etc.) */
  spaceType?: string
  /** Concurrent booking capacity (null = 1) */
  capacity?: number | null
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
                ((b.district as { name?: string } | null)?.name ? 'District' : null) ??
                'District',
            })
          )

          // Merge unassigned spaces (outdoor areas, hubs, etc.)
          const unassignedSpaces = json.data.unassignedSpaces ?? json.data.unassignedAreas ?? []
          const spacesAsBuildings: BuildingRaw[] = unassignedSpaces.map(
            (s: { id: string; name: string; rooms?: RoomRaw[]; status?: string; spaceType?: string; capacity?: number | null }) => ({
              id: s.id,
              name: s.name,
              rooms: s.rooms ?? [],
              areas: [],
              isSpace: true,
              groupLabel: 'Outdoor & Spaces',
              status: s.status as BuildingRaw['status'],
              spaceType: s.spaceType,
              capacity: s.capacity,
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

// ─── Campus Pill Scroller ───────────────────────────────────────────────────

function CampusPillScroller({
  groups,
  activeTab,
  onTabChange,
}: {
  groups: Array<{ label: string }>
  activeTab: string | null
  onTabChange: (tab: string | null) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 2)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2)
  }, [])

  useEffect(() => {
    checkScroll()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', checkScroll, { passive: true })
    const ro = new ResizeObserver(checkScroll)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', checkScroll); ro.disconnect() }
  }, [checkScroll, groups.length])

  function scroll(dir: 'left' | 'right') {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir === 'left' ? -160 : 160, behavior: 'smooth' })
  }

  return (
    <div className="flex items-center gap-0 border-b border-slate-100 mb-1">
      {/* Left arrow */}
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); scroll('left') }}
        className={`flex-shrink-0 w-6 h-8 flex items-center justify-center transition-opacity cursor-pointer ${
          canScrollLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {/* Single-row scrollable pills */}
      <div
        ref={scrollRef}
        className="flex-1 flex items-center gap-0.5 py-1.5 overflow-x-auto scrollbar-none"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onTabChange(null) }}
          className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap flex-shrink-0 ${
            activeTab === null
              ? 'bg-slate-900 text-white'
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
          }`}
        >
          All
        </button>
        {groups.map((g) => (
          <button
            key={g.label}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onTabChange(g.label) }}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap flex-shrink-0 ${
              activeTab === g.label
                ? 'bg-slate-900 text-white'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Right arrow */}
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); scroll('right') }}
        className={`flex-shrink-0 w-6 h-8 flex items-center justify-center transition-opacity cursor-pointer ${
          canScrollRight ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
      </button>
    </div>
  )
}

// ─── Room List (flat — buildings have rooms, no sub-grouping) ───────────────

function RoomItem({
  room,
  label,
  selected,
  onSelect,
}: {
  room: RoomRaw
  label: string
  selected: boolean
  onSelect: (room: RoomRaw) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(room)}
      className={`w-full flex items-center gap-3 px-4 py-2 text-left text-sm transition-colors cursor-pointer ${
        selected ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
      }`}
    >
      <DoorOpen className={`w-3.5 h-3.5 flex-shrink-0 ${selected ? 'text-indigo-500' : 'text-slate-300'}`} />
      <span className="flex-1">{label}</span>
      {room.floor && <span className="text-[10px] text-slate-400">Floor {room.floor}</span>}
    </button>
  )
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function LocationPicker({ value, onChange, error, spaceTypeFilter, hideOffCampus }: LocationPickerProps) {
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
  // Buildings have rooms; spaces don't
  const availableRooms: RoomRaw[] = selectedBuilding && !selectedBuilding.isSpace
    ? (selectedBuilding.rooms ?? [])
    : []
  const selectedRoom = availableRooms.find((r) => r.id === value.roomId) ?? null

  // All groups (unfiltered) for tab labels
  const allGroups = groupBuildings(buildings)

  // Filter buildings by search + active tab + space type filter
  const filteredBuildings = buildings.filter((b) => {
    if (buildingSearch && !b.name.toLowerCase().includes(buildingSearch.toLowerCase())) return false
    if (activeTab && (b.groupLabel ?? 'General') !== activeTab) return false
    // Space type filter (only applies to spaces, not buildings)
    if (spaceTypeFilter && spaceTypeFilter.length > 0 && b.isSpace && b.spaceType) {
      if (!spaceTypeFilter.includes(b.spaceType)) return false
    }
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

    // Spaces are standalone locations — no rooms to pick
    if (building.isSpace) {
      onChange({
        ...value,
        buildingId: building.id,
        areaId: null,
        roomId: null,
        locationText: building.name,
      })
      return
    }

    // Buildings may have rooms
    const allRooms = building.rooms ?? []

    if (allRooms.length === 1) {
      const room = allRooms[0]
      const roomLabel = room.displayName || room.roomNumber || 'Room'
      onChange({
        ...value,
        buildingId: building.id,
        areaId: null,
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
        {!hideOffCampus && <button
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
        </button>}
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
                  {/* Category pill tabs — scrollable with arrows */}
                  {allGroups.length > 1 && (
                    <CampusPillScroller
                      groups={allGroups}
                      activeTab={activeTab}
                      onTabChange={setActiveTab}
                    />
                  )}
                  {/* Items */}
                  {filteredBuildings.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-slate-400 text-center">No locations found</p>
                  ) : (
                    filteredBuildings.map((b) => {
                      const roomCount = b.rooms?.length ?? 0
                      const typeLabel = b.isSpace ? 'Space' : 'Building'
                      const isBlocked = b.status === 'UNDER_MAINTENANCE' || b.status === 'CLOSED'

                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => !isBlocked && handleSelectBuilding(b)}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                            isBlocked
                              ? 'opacity-60 cursor-not-allowed'
                              : value.buildingId === b.id
                                ? 'bg-slate-100 cursor-pointer'
                                : 'hover:bg-slate-50 cursor-pointer'
                          }`}
                        >
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                            isBlocked
                              ? 'bg-red-100 text-red-600'
                              : b.isSpace ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {b.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium text-slate-800 truncate">{b.name}</p>
                              {b.status === 'UNDER_MAINTENANCE' && (
                                <span className="text-[9px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
                                  Maintenance
                                </span>
                              )}
                              {b.status === 'CLOSED' && (
                                <span className="text-[9px] font-semibold text-red-700 bg-red-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
                                  Closed
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400">{typeLabel}</p>
                          </div>
                          {!b.isSpace && roomCount > 0 && (
                            <span className="text-[10px] text-slate-300 flex-shrink-0">
                              {roomCount} room{roomCount === 1 ? '' : 's'}
                            </span>
                          )}
                          {b.isSpace && b.capacity && b.capacity > 1 && (
                            <span className="text-[10px] text-slate-400 flex-shrink-0">
                              {b.capacity} slots
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
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-hidden">
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
                  <div className="overflow-y-auto max-h-52">
                    {filteredRooms.length === 0 ? (
                      <p className="px-4 py-3 text-xs text-slate-400 text-center">No rooms found</p>
                    ) : (
                      filteredRooms.map((r) => (
                        <RoomItem
                          key={r.id}
                          room={r}
                          label={getRoomLabel(r)}
                          selected={r.id === value.roomId}
                          onSelect={handleSelectRoom}
                        />
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
              <Input
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
                size="sm"
                className="h-auto min-h-0 flex-1 border-0 bg-transparent p-0 text-sm text-slate-900 shadow-none outline-none placeholder:text-slate-400 focus:ring-0"
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
