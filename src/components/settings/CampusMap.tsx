'use client'

import { useEffect, useState } from 'react'
import { MapPin, Loader2 } from 'lucide-react'

interface MapData {
  org: {
    lat: number | null
    lng: number | null
    name: string
    address: string | null
  } | null
  buildings: Array<{
    id: string
    name: string
    code: string | null
    lat: number
    lng: number
  }>
}

export default function CampusMap() {
  const [mapData, setMapData] = useState<MapData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null

  useEffect(() => {
    if (!token) return

    const fetchMapData = async () => {
      try {
        const res = await fetch('/api/settings/campus/map-data', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          if (data.ok) {
            setMapData(data.data)
          }
        }
      } catch {
        setError('Failed to load map data')
      } finally {
        setLoading(false)
      }
    }

    fetchMapData()
  }, [token])

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error) {
    return null // Silently hide on error
  }

  const orgLat = mapData?.org?.lat
  const orgLng = mapData?.org?.lng

  if (!orgLat || !orgLng) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
        <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">
          Add a school address in <span className="font-medium">School Information</span> to see your campus on the map.
        </p>
      </div>
    )
  }

  // Build Google Maps Embed URL
  // Using "place" mode with coordinates for the org location
  const apiKey = '' // Key is NOT exposed client-side — use a server-rendered approach or restrict the key to Maps Embed API referrers
  const query = encodeURIComponent(mapData?.org?.address || `${orgLat},${orgLng}`)

  // Use a keyless embed via Google Maps iframe (works for basic embeds)
  const embedUrl = `https://www.google.com/maps?q=${query}&z=16&output=embed`

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-gray-700">Campus Location</span>
        </div>
        {mapData?.org?.address && (
          <span className="text-xs text-gray-500 truncate max-w-xs">{mapData.org.address}</span>
        )}
      </div>
      <iframe
        src={embedUrl}
        width="100%"
        height="300"
        style={{ border: 0 }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        title="Campus Map"
      />
    </div>
  )
}
