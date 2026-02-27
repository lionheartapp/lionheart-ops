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

interface BrandfetchResponse {
  brand: {
    logos: Array<{ src: string }> | null
    colors: Array<{ hex: string }> | null
  } | null
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

    const result: Partial<SchoolLookupResult> = {
      logo: data.brand?.logos?.[0]?.src || null,
      colors: {
        primary: data.brand?.colors?.[0]?.hex || null,
        secondary: data.brand?.colors?.[1]?.hex || null,
        accent: data.brand?.colors?.[2]?.hex || null,
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
async function extractWithGemini(htmlText: string, domain: string): Promise<Partial<SchoolLookupResult> | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    console.log('Gemini API key not set, skipping layer 2')
    return null
  }

  try {
    const client = new GoogleGenAI({ apiKey })

    const prompt = `Extract school information from the following website text for domain: ${domain}

Please extract and return ONLY a JSON object (no markdown, no extra text) with these fields:
{
  "phone": "main phone number or null",
  "address": "physical street address or null",
  "principalName": "principal's name or null",
  "principalEmail": "principal's email or null",
  "district": "school district name or null",
  "gradeRange": "grade range like 'K-5' or 'elementary' or null",
  "institutionType": "public/private/charter or null",
  "studentCount": number or null,
  "staffCount": number or null
}

Website text:
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

    return result
  } catch (error) {
    console.error('Gemini extraction error:', error instanceof Error ? error.message : error)
    return null
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

  // Extract og:image
  const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)
  if (ogImageMatch) {
    result.logo = ogImageMatch[1]
  }

  // Extract theme-color
  const themeColorMatch = html.match(/<meta\s+name=["']theme-color["']\s+content=["']([^"']+)["']/i)
  if (themeColorMatch) {
    result.colors!.primary = themeColorMatch[1]
  }

  // Extract apple-touch-icon
  const appleTouchMatch = html.match(/<link\s+rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i)
  if (appleTouchMatch && !result.logo) {
    result.logo = appleTouchMatch[1]
  }

  // Extract favicon
  const faviconMatch = html.match(/<link\s+rel=["']icon["'][^>]*href=["']([^"']+)["']/i)
  if (faviconMatch && !result.logo) {
    result.logo = faviconMatch[1]
  }

  return result
}

// Main lookup function
export async function lookupSchool(website: string): Promise<SchoolLookupResult> {
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
      const geminiData = await extractWithGemini(htmlText, domain)
      if (geminiData) {
        Object.assign(result, geminiData)
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
