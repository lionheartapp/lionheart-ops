/**
 * Address Validation Service
 *
 * Uses Google Address Validation API to verify and format addresses.
 * Returns formatted address + coordinates when available.
 */

export interface AddressValidationResult {
  valid: boolean
  formattedAddress: string
  lat: number | null
  lng: number | null
  suggestion?: string   // If the corrected address differs significantly from input
}

/**
 * Validate and format a physical address.
 * Returns null if the API is unavailable or the key is missing.
 */
export async function validateAddress(address: string): Promise<AddressValidationResult | null> {
  const apiKey = (
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY
  )?.trim()

  if (!apiKey) {
    console.warn('[AddressValidation] No API key found')
    return null
  }

  try {
    const res = await fetch(
      `https://addressvalidation.googleapis.com/v1:validateAddress?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: {
            addressLines: [address],
          },
        }),
        signal: AbortSignal.timeout(5000),
      }
    )

    if (!res.ok) {
      console.warn(`[AddressValidation] API returned ${res.status}`)
      return null
    }

    const data = await res.json()
    const result = data.result

    if (!result) {
      return null
    }

    const verdict = result.verdict || {}
    const formattedAddress = result.address?.formattedAddress || address
    const geocode = result.geocode?.location

    // Determine if the address is "valid" based on the verdict
    const valid = verdict.addressComplete === true ||
      verdict.validationGranularity === 'PREMISE' ||
      verdict.validationGranularity === 'SUB_PREMISE'

    // If the formatted address is significantly different, include as suggestion
    const inputNorm = address.toLowerCase().replace(/[^a-z0-9]/g, '')
    const formattedNorm = formattedAddress.toLowerCase().replace(/[^a-z0-9]/g, '')
    const suggestion = inputNorm !== formattedNorm ? formattedAddress : undefined

    return {
      valid,
      formattedAddress,
      lat: geocode?.latitude ?? null,
      lng: geocode?.longitude ?? null,
      suggestion,
    }
  } catch (error) {
    console.error('[AddressValidation] Error:', error)
    return null
  }
}
