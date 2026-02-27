/**
 * School Lookup Service
 *
 * AI-powered school data extraction using 3 layers:
 * 1. Brandfetch API for logo and colors
 * 2. Website scraping + Gemini for structured data extraction
 * 3. Meta tag fallback for basic styling
 */

import { GoogleGenAI } from '@google/genai'

interface SchoolLookupResult {
  logo: string | null
  colors: {
    primary: string | null
    secondary: string | null
    accent: string | null
  }
  phone: string | null
  address: string | null
  principalName: string | null
  principalEmail: string | null
  district: string | null
  gradeRange: string | null
  institutionType: string | null
  studentCount: number | null
  staffCount: number | null
  confidence: number // 0-100 score
}

// Brandfetch v2 API response shape
interface BrandfetchLogo {
  theme: string
  formats: Array<{ src: string; format: string }>
  type: string
}

interface BrandfetchColor {
  hex: string
  type: string
  brightness: number
}

interface BrandfetchResponse {
  name?: string
  logos?: BrandfetchLogo[]
  colors?: BrandfetchColor[]
  // Legacy nested shape (some endpoints)
  brand?: {
    logos?: Array<{ src: string }>
    colors?: Array<{ hex: string }>
  }
}

interface GeminiExtractionResult {
  phone?: string
  address?: string
  principalName?: string
  principalEmail?: string
  district?: string
  gradeRange?: string
  institutionType?: string
  studentCount?: number
  staffCount?: number
  primaryColor?: string
}

// Helper: Extract domain from URL
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
    return urlObj.hostname.replace('www.', '')
  } catch {
    return url.replace('www.', '')
  }
}

// Layer 0: Google Places API for address + phone
async function fetchFromGooglePlaces(schoolName: string, website: string): Promise<Partial<SchoolLookupResult> | null> {
  const apiKey = (process.env.GOOGLE_PLACES_API_KEY || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY)?.trim()
  if (!apiKey) {
    console.log('No Google API key found, skipping Places lookup')
    return null
  }

  try {
    // Use Places API (New) Text Search
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri',
      },
      body: JSON.stringify({
        textQuery: `${schoolName} school`,
        maxResultCount: 3,
      }),
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      console.log(`Google Places API returned ${response.status}`)
      return null
    }

    const data = await response.json()
    const places = data.places

    if (!places || places.length === 0) {
      console.log('No places found for:', schoolName)
      return null
    }

    // Try to find the best match — prefer one whose website matches
    const domain = extractDomain(website)
    let bestPlace = places[0]
    for (const place of places) {
      if (place.websiteUri) {
        const placeDomain = extractDomain(place.websiteUri)
        if (placeDomain === domain) {
          bestPlace = place
          break
        }
      }
    }

    const result: Partial<SchoolLookupResult> = {}

    if (bestPlace.formattedAddress) {
      result.address = bestPlace.formattedAddress
    }

    const phone = bestPlace.nationalPhoneNumber || bestPlace.internationalPhoneNumber
    if (phone) {
      result.phone = phone
    }

    console.log(`Google Places found: address="${result.address}", phone="${result.phone}"`)
    return result
  } catch (error) {
    console.error('Google Places error:', error instanceof Error ? error.message : error)
    return null
  }
}

// Layer 1: Fetch from Brandfetch API
async function fetchFromBrandfetch(domain: string): Promise<Partial<SchoolLookupResult> | null> {
  const apiKey = process.env.BRANDFETCH_API_KEY?.trim()
  if (!apiKey) {
    console.log('Brandfetch API key not set, skipping layer 1')
    return null
  }

  try {
    const response = await fetch(`https://api.brandfetch.io/v2/brands/${domain}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      console.log(`Brandfetch API returned ${response.status} for ${domain}`)
      return null
    }

    const data: BrandfetchResponse = await response.json()

    // Extract logo — prefer SVG or PNG from the "icon" or "logo" type
    let logoUrl: string | null = null
    if (data.logos && data.logos.length > 0) {
      // Prefer icon type, then logo type
      const iconLogo = data.logos.find((l) => l.type === 'icon')
      const primaryLogo = data.logos.find((l) => l.type === 'logo')
      const bestLogo = iconLogo || primaryLogo || data.logos[0]

      if (bestLogo?.formats && bestLogo.formats.length > 0) {
        // Prefer PNG or SVG
        const pngFormat = bestLogo.formats.find((f) => f.format === 'png')
        const svgFormat = bestLogo.formats.find((f) => f.format === 'svg')
        logoUrl = pngFormat?.src || svgFormat?.src || bestLogo.formats[0].src
      }
    }
    // Fallback to legacy shape
    if (!logoUrl && data.brand?.logos?.[0]?.src) {
      logoUrl = data.brand.logos[0].src
    }

    // Extract colors — look for "dark" colors which are typically the primary brand color
    let primaryColor: string | null = null
    let secondaryColor: string | null = null
    let accentColor: string | null = null

    if (data.colors && data.colors.length > 0) {
      // Dark colors are usually the primary brand color (not white/light backgrounds)
      const darkColors = data.colors.filter((c) => c.brightness < 100)
      const lightColors = data.colors.filter((c) => c.brightness >= 100)

      if (darkColors.length > 0) {
        primaryColor = darkColors[0].hex
        secondaryColor = darkColors[1]?.hex || lightColors[0]?.hex || null
        accentColor = darkColors[2]?.hex || lightColors[1]?.hex || null
      } else {
        primaryColor = data.colors[0].hex
        secondaryColor = data.colors[1]?.hex || null
        accentColor = data.colors[2]?.hex || null
      }
    }
    // Fallback to legacy shape
    if (!primaryColor && data.brand?.colors) {
      primaryColor = data.brand.colors[0]?.hex || null
      secondaryColor = data.brand.colors[1]?.hex || null
      accentColor = data.brand.colors[2]?.hex || null
    }

    // Ensure hex colors have # prefix
    const ensureHash = (c: string | null) => c && !c.startsWith('#') ? `#${c}` : c

    const result: Partial<SchoolLookupResult> = {
      logo: logoUrl,
      colors: {
        primary: ensureHash(primaryColor),
        secondary: ensureHash(secondaryColor),
        accent: ensureHash(accentColor),
      },
    }

    return result
  } catch (error) {
    console.error('Brandfetch error:', error instanceof Error ? error.message : error)
    return null
  }
}

// Helper: Fetch website HTML
async function fetchWebsiteHtml(url: string): Promise<string | null> {
  try {
    const urlToFetch = url.startsWith('http') ? url : `https://${url}`

    const response = await fetch(urlToFetch, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      console.log(`Website fetch returned ${response.status} for ${url}`)
      return null
    }

    return await response.text()
  } catch (error) {
    console.error('Website fetch error:', error instanceof Error ? error.message : error)
    return null
  }
}

// Helper: Strip HTML to plain text
function stripHtmlToText(html: string): string {
  // Remove scripts and styles
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ')

  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')

  // Collapse whitespace
  text = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n')

  return text.slice(0, 5000) // Limit to 5000 chars for API
}

// Layer 2: Gemini AI extraction
async function extractWithGemini(htmlText: string, rawHtml: string, domain: string): Promise<Partial<SchoolLookupResult> | null> {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY)?.trim()
  if (!apiKey) {
    console.log('Gemini API key not set (checked GEMINI_API_KEY and NEXT_PUBLIC_GEMINI_API_KEY), skipping layer 2')
    return null
  }

  try {
    const client = new GoogleGenAI({ apiKey })

    // Extract CSS color hints from raw HTML for the AI to analyze
    const cssSnippet = extractCssColorHints(rawHtml)

    const prompt = `You are analyzing a school website for domain: ${domain}

Extract the following information and return ONLY a JSON object (no markdown, no code fences, no extra text):
{
  "phone": "main phone number or null",
  "address": "full physical street address including city, state, zip or null",
  "principalName": "principal or head of school name or null",
  "principalEmail": "principal email or null",
  "district": "school district name or null",
  "gradeRange": "grade range like 'K-5', 'PK-8', '9-12' or null",
  "institutionType": "public, private, charter, or hybrid - or null",
  "studentCount": number or null,
  "staffCount": number or null,
  "primaryColor": "the school's primary brand color as a hex code (e.g. #1a2b3c) — look at navigation bars, headers, buttons, and prominent UI elements to determine the school's brand color. This is NOT the text color. It is the dominant accent/brand color used in the site design. Return null if you cannot determine it."
}

IMPORTANT for primaryColor: Look at the CSS styles, inline styles, background colors of headers/navbars/buttons. The primary color is the school's brand color, often used in the navigation bar, header background, or primary buttons. Do NOT return black, white, or gray as the primary color.

${cssSnippet ? `CSS color hints from the page:\n${cssSnippet}\n` : ''}
Website text content:
${htmlText}`

    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    })
    const responseText = response.text || ''

    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.log('No JSON found in Gemini response')
      return null
    }

    const extracted: GeminiExtractionResult = JSON.parse(jsonMatch[0])

    const result: Partial<SchoolLookupResult> = {
      phone: extracted.phone || null,
      address: extracted.address || null,
      principalName: extracted.principalName || null,
      principalEmail: extracted.principalEmail || null,
      district: extracted.district || null,
      gradeRange: extracted.gradeRange || null,
      institutionType: extracted.institutionType || null,
      studentCount: extracted.studentCount || null,
      staffCount: extracted.staffCount || null,
    }

    // If Gemini found a primary color, include it
    if (extracted.primaryColor && extracted.primaryColor !== 'null') {
      result.colors = {
        primary: extracted.primaryColor.startsWith('#') ? extracted.primaryColor : `#${extracted.primaryColor}`,
        secondary: null,
        accent: null,
      }
    }

    return result
  } catch (error) {
    console.error('Gemini extraction error:', error instanceof Error ? error.message : error)
    return null
  }
}

// Helper: Extract CSS color hints from raw HTML for AI analysis
function extractCssColorHints(html: string): string {
  const hints: string[] = []

  // Extract inline style background-color values
  const bgColorMatches = html.match(/background-color\s*:\s*([^;"'}]+)/gi)
  if (bgColorMatches) {
    const unique = [...new Set(bgColorMatches.slice(0, 10))]
    hints.push(...unique)
  }

  // Extract CSS custom properties (often used for brand colors)
  const cssVarMatches = html.match(/--[a-z-]*color[a-z-]*\s*:\s*([^;"'}]+)/gi)
  if (cssVarMatches) {
    const unique = [...new Set(cssVarMatches.slice(0, 10))]
    hints.push(...unique)
  }

  // Extract hex colors from style blocks
  const hexMatches = html.match(/#[0-9a-fA-F]{3,8}(?=[;\s"'}])/g)
  if (hexMatches) {
    // Filter out common non-brand colors (pure black, white, grays)
    const nonBrand = new Set(['#000', '#000000', '#fff', '#ffffff', '#333', '#333333', '#666', '#666666', '#999', '#999999', '#ccc', '#cccccc', '#eee', '#eeeeee', '#f5f5f5', '#fafafa'])
    const brandColors = hexMatches.filter((c) => !nonBrand.has(c.toLowerCase()))
    const unique = [...new Set(brandColors.slice(0, 15))]
    if (unique.length > 0) {
      hints.push(`Hex colors found: ${unique.join(', ')}`)
    }
  }

  return hints.slice(0, 20).join('\n')
}

// Helper: Resolve relative URLs to absolute
function resolveUrl(url: string, baseUrl: string): string {
  if (!url) return url
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url
  }
  try {
    const base = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`
    return new URL(url, base).href
  } catch {
    return url
  }
}

// Layer 3: Meta tag extraction
function extractMetaTags(html: string): Partial<SchoolLookupResult> {
  const result: Partial<SchoolLookupResult> = {
    colors: {
      primary: null,
      secondary: null,
      accent: null,
    },
  }

  // Extract og:image (both attribute orders)
  const ogImageMatch = html.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i)
    || html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i)
  if (ogImageMatch) {
    result.logo = ogImageMatch[1]
  }

  // Extract theme-color (both attribute orders)
  const themeColorMatch = html.match(/<meta\s+name=["']theme-color["']\s+content=["']([^"']+)["']/i)
    || html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']theme-color["']/i)
  if (themeColorMatch) {
    result.colors!.primary = themeColorMatch[1]
  }

  // Extract msapplication-TileColor as fallback brand color
  if (!result.colors!.primary) {
    const tileColorMatch = html.match(/<meta\s+name=["']msapplication-TileColor["']\s+content=["']([^"']+)["']/i)
      || html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']msapplication-TileColor["']/i)
    if (tileColorMatch) {
      result.colors!.primary = tileColorMatch[1]
    }
  }

  // Extract apple-touch-icon
  const appleTouchMatch = html.match(/<link\s+rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i)
  if (appleTouchMatch && !result.logo) {
    result.logo = appleTouchMatch[1]
  }

  // Extract favicon (larger sizes preferred)
  if (!result.logo) {
    const faviconMatch = html.match(/<link\s+rel=["'](?:icon|shortcut icon)["'][^>]*href=["']([^"']+)["']/i)
    if (faviconMatch) {
      result.logo = faviconMatch[1]
    }
  }

  return result
}

// Main lookup function
export async function lookupSchool(website: string, schoolName?: string): Promise<SchoolLookupResult> {
  const domain = extractDomain(website)

  // Initialize result with null values
  const result: SchoolLookupResult = {
    logo: null,
    colors: {
      primary: null,
      secondary: null,
      accent: null,
    },
    phone: null,
    address: null,
    principalName: null,
    principalEmail: null,
    district: null,
    gradeRange: null,
    institutionType: null,
    studentCount: null,
    staffCount: null,
    confidence: 0,
  }

  let layersSucceeded = 0

  try {
    // Layer 0: Google Places API for address + phone
    const placesName = schoolName || domain.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
    const placesData = await fetchFromGooglePlaces(placesName, website)
    if (placesData) {
      Object.assign(result, placesData)
      layersSucceeded++
    }

    // Layer 1: Brandfetch
    const brandfetchData = await fetchFromBrandfetch(domain)
    if (brandfetchData) {
      Object.assign(result, brandfetchData)
      layersSucceeded++
    }

    // Layer 2: Website scraping + Gemini
    const html = await fetchWebsiteHtml(website)
    if (html) {
      const htmlText = stripHtmlToText(html)
      const geminiData = await extractWithGemini(htmlText, html, domain)
      if (geminiData) {
        // Merge Gemini data but handle colors specially
        const geminiColors = geminiData.colors
        delete geminiData.colors
        Object.assign(result, geminiData)

        // Prefer Gemini's AI-detected color over Brandfetch when available
        // (Brandfetch can return the wrong brand for schools)
        if (geminiColors?.primary) {
          result.colors.primary = geminiColors.primary
        }

        layersSucceeded++
      }

      // Layer 3: Meta tag fallback
      const metaTags = extractMetaTags(html)
      if (!result.logo && metaTags.logo) {
        result.logo = metaTags.logo
      }
      if (!result.colors.primary && metaTags.colors?.primary) {
        result.colors.primary = metaTags.colors.primary
      }
      layersSucceeded++
    }
  } catch (error) {
    console.error('School lookup error:', error instanceof Error ? error.message : error)
  }

  // Resolve any relative logo URLs to absolute
  if (result.logo && !result.logo.startsWith('http') && !result.logo.startsWith('data:')) {
    result.logo = resolveUrl(result.logo, website)
  }

  // Calculate confidence score
  // Confidence is based on how many layers succeeded and how many fields were filled
  const fieldsFilledScore =
    (result.logo ? 10 : 0) +
    (result.phone ? 15 : 0) +
    (result.address ? 15 : 0) +
    (result.principalName ? 10 : 0) +
    (result.principalEmail ? 10 : 0) +
    (result.district ? 10 : 0) +
    (result.gradeRange ? 10 : 0) +
    (result.institutionType ? 10 : 0)

  result.confidence = Math.min(100, (layersSucceeded / 3) * 50 + fieldsFilledScore)

  return result
}
