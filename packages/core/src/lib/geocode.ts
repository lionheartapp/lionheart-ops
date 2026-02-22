/**
 * Geocode address to lat/long using OpenStreetMap Nominatim. No API key required.
 */

export async function geocodeAddress(address: string): Promise<{ latitude: number; longitude: number } | null> {
  const trimmed = address?.trim()
  if (!trimmed) return null

  const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
    q: trimmed,
    format: 'json',
    limit: '1',
  })}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Lionheart-SchoolOps/1.0 (water-management-geocode)',
    },
  })

  if (!res.ok) return null

  const data = (await res.json()) as Array<{ lat?: string; lon?: string }>
  const first = data?.[0]
  if (!first?.lat || !first?.lon) return null

  const latitude = parseFloat(first.lat)
  const longitude = parseFloat(first.lon)
  if (isNaN(latitude) || isNaN(longitude)) return null

  return { latitude, longitude }
}
