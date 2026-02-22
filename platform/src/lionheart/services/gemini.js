import { GoogleGenAI } from '@google/genai'
import { getOrgContextForAI } from '../config/orgContext'

/** Safe read: works in Next.js (process.env.NEXT_PUBLIC_*) and Vite (import.meta.env.VITE_*). */
function getGeminiApiKey() {
  return (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_GEMINI_API_KEY?.trim()) ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY?.trim()) ||
    ''
}

// Exponential backoff delays (ms): 15s, 30s, 60s
const RATE_LIMIT_BACKOFF_MS = [15000, 30000, 60000]
const RATE_LIMIT_MAX_RETRIES = 3

/** Execute fn, retrying on 429 rate limit errors with exponential backoff. */
async function withRateLimitRetry(fn) {
  let lastErr
  for (let attempt = 0; attempt <= RATE_LIMIT_MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const status = err?.status ?? err?.statusCode ?? err?.httpStatus
      const msg = String(err?.message ?? '')
      const isRateLimit = status === 429 || /429|too many requests|rate limit|resource exhausted|quota/i.test(msg)
      const canRetry = attempt < RATE_LIMIT_MAX_RETRIES
      if (isRateLimit && canRetry) {
        const delayMs = RATE_LIMIT_BACKOFF_MS[attempt] ?? 60000
        await new Promise((r) => setTimeout(r, delayMs))
        continue
      }
      if (isRateLimit) {
        throw new Error(
          'API rate limit reached. Gemini API limits are per project in AI Studio (aistudio.google.com)—separate from a Gemini Advanced subscription. Using Smart Event, AI Form, and Form Builder AI in quick succession shares the same quota. Wait 1–2 minutes, or check aistudio.google.com/usage to see your tier and request an increase.'
        )
      }
      throw err
    }
  }
  throw lastErr
}

const DEFAULT_SYSTEM_BASE = `You are a friendly school operations assistant helping staff create and schedule events. Follow a consistent flow of questions and allow discussion and suggestions at each step.

Tone: Sound natural and warm. Use contractions. Keep replies short (1–3 sentences). Never repeat the start of your sentence or double words.

Flow (ask in this order; one topic at a time; discuss and suggest as you go):
1. Basics: event name, date, time, venue (and category or brief description if it comes up).
2. Facilities: chairs, tables, setup/teardown, and any special requests (e.g. "Do you need chairs and tables? Any specific layout or special requests for the space?"). Offer suggestions (e.g. "For 50 people we usually do 8–10 tables—want me to put that in?").
3. Tech / A/V: projector, screen, mics, speakers, lighting, or other A/V needs. Ask explicitly: "Will you need A/V—projector, mics, speakers, or lighting?" and suggest based on event type.
4. Event options: ticketing (free, paid, or pay-what-you-can), signup, or registration. Ask: "Will this have tickets or signup, or is it open entry?"
5. Notes: Ask "Any notes or special requests?" — capture anything the user wants staff to know (early access, mic setup, reminders, etc.).
6. When you have the above (at least name, date, time, venue), wrap up: confirm key details and say they can reply "yes" or "that\'s it" when ready—then an **Approve & Save to calendar** button will appear in the chat.

Rules:
- Answer direct questions using the "Current schedule note" when relevant (conflicts, practice times). The note may include venue conflicts and parking (same date, same or nearby lot)—mention both if present.
- Don’t skip facilities or A/V—always ask about chairs/tables and tech needs unless they’ve already said.
- Offer concrete suggestions (e.g. "We can block the PAC and get 15 tables and 100 chairs—sound good?").
- When wrapping up, mention they can reply "yes" or "that's it" to get the Approve button.`

const DEFAULT_SYSTEM = `${getOrgContextForAI()}\n\n${DEFAULT_SYSTEM_BASE}`

const EVENT_EXTRACTION_SYSTEM = `You extract event details from a user's message in a chat about scheduling an event. Consider the conversation context.

Return ONLY valid JSON, no markdown or extra text:
{"name": "Event Name" or null, "date": "YYYY-MM-DD" or null, "time": "HH:MM" in 24hr or null, "location": "..." or null}

Rules for the EVENT NAME:
- If they say "call it X", "call it the X", "lets call it X", "name it X", "its X", "it's X", "we'll call it X" → name is just X (proper title case, e.g. "Worship Night" not "call it worship night").
- Strip all conversational prefixes. "call it worship night" → "Worship Night". "call it the spring gala" → "Spring Gala".
- Use Title Case for the name.
- Return null if no event name is given or implied.
- Never include filler words like "call it", "lets call it", "name it", "its" in the name.
- NEVER use ticketing/signup terms as the event name: "open entry", "free entry", "no tickets", "pay what you can", "signup", "registration" are NOT event names — return null for name if the user only said one of these.

Rules for DATE:
- IMPORTANT: The prompt includes "Today is YYYY-MM-DD" — use that year for all dates. Never use 2024 or 2025 unless the user explicitly says that year.
- "next Thursday" = the upcoming Thursday from today. "tomorrow" = next day. "today" = today. Use YYYY-MM-DD.
- For "March 13" or "3/13" without a year, use the current year from the prompt.
- Return null if no date given.

Rules for TIME:
- "9am" → "09:00", "5pm" → "17:00", "noon" → "12:00". Use 24hr format HH:MM.
- Return null if no time given.

Rules for LOCATION:
- "gym" → "Gym", "PAC" → "PAC", "cafeteria" → "Cafeteria". Use proper casing.
- Return null if no location given.

Output ONLY the JSON object, nothing else.`

/**
 * Extract event fields (name, date, time, location) from user message using natural language understanding.
 * Use this to reliably capture names like "call it worship night" → "Worship Night".
 * @param {Array<{ role: 'user'|'assistant', content: string }>} messages - Recent chat history
 * @returns {Promise<{ name?: string, date?: string, time?: string, location?: string }>}
 */
export async function extractEventFieldsWithGemini(messages = []) {
  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    return {}
  }

  const ai = new GoogleGenAI({ apiKey: apiKey.trim() })
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const year = now.getFullYear()
  const prompt = `Today is ${todayStr} (year ${year}). Extract event details from the latest user message. Conversation:\n\n${messages.map((m) => `${m.role}: ${m.content}`).join('\n')}\n\nFocus on the LATEST user message. When computing dates like "next Thursday" or "March 13", use year ${year}. Return JSON only.`

  try {
    const response = await withRateLimitRetry(() =>
      ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          systemInstruction: EVENT_EXTRACTION_SYSTEM,
        },
      })
    )

    const text = response?.text?.trim()
    if (!text) return {}

    let jsonStr = text
    const codeMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeMatch) jsonStr = codeMatch[1].trim()

    const parsed = JSON.parse(jsonStr)
    if (!parsed || typeof parsed !== 'object') return {}

    const result = {}
    if (parsed.name && typeof parsed.name === 'string' && parsed.name.trim()) {
      result.name = parsed.name.trim()
    }
    if (parsed.date && typeof parsed.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date.trim())) {
      const d = parsed.date.trim()
      const [y] = d.split('-').map(Number)
      const currentYear = new Date().getFullYear()
      // If AI returned a past year, use current year
      const fixed = y < currentYear ? d.replace(/^\d{4}/, String(currentYear)) : d
      result.date = fixed
    }
    if (parsed.time && typeof parsed.time === 'string' && /^\d{1,2}:\d{2}$/.test(parsed.time.trim())) {
      const [h, m] = parsed.time.trim().split(':').map(Number)
      result.time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    }
    if (parsed.location && typeof parsed.location === 'string' && parsed.location.trim()) {
      result.location = parsed.location.trim()
    }
    return result
  } catch {
    return {}
  }
}

/**
 * @param {Object} opts
 * @param {Array<{ role: 'user'|'assistant', content: string }>} opts.messages - Chat history (user/assistant with content)
 * @param {string} [opts.systemInstruction] - Override system instruction
 * @param {string} [opts.conflictNote] - Optional line injected into context (e.g. "Schedule note: Gym has Basketball until 6:30 PM. Suggest 7 PM or PAC.")
 * @returns {Promise<string>} Model reply text
 */
export async function chatWithGemini({ messages = [], systemInstruction, conflictNote }) {
  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    throw new Error('Missing Gemini API key. Add NEXT_PUBLIC_GEMINI_API_KEY (or VITE_GEMINI_API_KEY) in .env and restart.')
  }

  const ai = new GoogleGenAI({ apiKey: apiKey.trim() })

  const system = systemInstruction ?? DEFAULT_SYSTEM
  const systemWithConflict = conflictNote
    ? `${system}\n\nCurrent schedule note (mention only if relevant): ${conflictNote}`
    : system

  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content || '' }],
  }))

  const response = await withRateLimitRetry(() =>
    ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents,
      config: {
        systemInstruction: systemWithConflict,
      },
    })
  )

  const text = response?.text
  if (text == null) {
    throw new Error('No text in Gemini response')
  }
  return text
}

const FORM_GENERATION_SYSTEM = `You are a form builder assistant. Given a user's description and/or an uploaded reference (document text or image), you generate a valid JSON form definition.

REFERENCE IS PRIMARY: When the user uploads a reference document (text content or image), it is your PRIMARY and often ONLY source. You MUST extract fields, labels, options, and structure FROM the reference. Do NOT invent or add fields that are not present in the reference. Only when NO reference is provided should you create a form from the user's description alone.

When reference text is provided: Parse it carefully. Identify form-like structures, field names, question text, options in lists/dropdowns. Map each to an appropriate field type. Preserve the exact wording from the reference.

When an image is provided: Analyze it carefully. Extract ALL visible form fields, labels, options, and structure. Create fields that match exactly what you see. Do not hallucinate or add fields that are not clearly visible in the image.

LAYOUT AND IMAGES: Pay close attention to the user's layout and image requests.
- If the user asks for a header image, cover image, cover photo, banner, or top image → set "layout": "header-cover" and include "imagePrompt" with a short descriptive prompt for generating that image (e.g. "Professional welcoming header banner for a volunteer application form, soft gradient, community feel").
- If the user asks for form with image, side image, form + image, or image next to the form → set "layout": "split" and include "imagePrompt" with a prompt for the side/promotional image.
- If the user asks you to create, generate, or make an image → include "imagePrompt" with a descriptive prompt. Also set "layout" to "header-cover" or "split" based on context (header-cover if it's a banner/cover, split if it's beside the form).
- Default "layout" is "default" when no image/layout is requested.

Output ONLY valid JSON, no markdown or extra text. Use this structure:
{
  "title": "Form title",
  "description": "Optional brief description of the form",
  "layout": "default",
  "imagePrompt": null,
  "submissionType": "general",
  "approverNames": null,
  "fields": [
    { "type": "text", "label": "Field label", "required": true, "placeholder": "optional", "targetKey": null },
    { "type": "email", "label": "Email" },
    { "type": "textarea", "label": "Comments" },
    { "type": "dropdown", "label": "Choose one", "options": ["Option A", "Option B"] },
    { "type": "yesno", "label": "Do you agree?" },
    { "type": "date", "label": "Preferred date" }
  ]
}

Omit imagePrompt or set to null when no image is requested. Use imagePrompt only when the user explicitly wants a header/cover/side image or asks to create or generate an image.

Allowed field types: text, textarea, number, email, phone, date, datetime, yesno, dropdown, radio, checkbox, checklist, section, slider, attachment, signature, hidden.
- Use "text" for short answers, "textarea" for long text.
- Use "dropdown" or "radio" for single choice from options. Include "options" array.
- Use "yesno" for Yes/No (no options needed).
- Use "section" to group fields (label becomes section title, add "description" for subtitle).
- Use "email" for email, "phone" for phone, "date" for date, "datetime" for date+time.
- Use "checklist" for multi-select from options.
- Use "number" for numeric input, "slider" for 0-100 range.
- Keep forms concise (typically 3-12 fields).

APPROVAL WORKFLOWS: When the user asks for a form that requires approval, or mentions specific approvers (e.g. @Michael Kerley, @Jane Smith, @Maria Garcia), or says "must be approved by" / "needs approval from":
- Set "submissionType": "event-request" if the form is for requesting events that get added to the calendar after approval. Otherwise use "general".
- Set "approverNames": ["Exact Name 1", "Exact Name 2"] with the full names of each person who must approve. Use exact names as the user mentioned them (e.g. "Michael Kerley", "Jane Smith", "Maria Garcia").
- For event-request forms: include fields for event details: Event name (text, targetKey: "name"), Date (date, targetKey: "date"), Time (text, targetKey: "time"), Location (text, targetKey: "location"), Description (textarea, targetKey: "description"), Requested by/Contact name (text, targetKey: "owner"). Add targetKey to map form data to calendar event.
- All listed approvers must approve before the event is added. Use "approverNames" array with full names.`

/**
 * Read a File as base64 string.
 * @param {File} file
 * @returns {Promise<{ data: string, mimeType: string }>}
 */
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      const base64 = typeof dataUrl === 'string' ? dataUrl.split(',')[1] : ''
      const mimeType = file.type || 'image/png'
      resolve({ data: base64, mimeType })
    }
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}

/**
 * Generate a form structure from a natural language description using Gemini.
 * @param {string} userDescription - What the user needs (e.g. "Event RSVP with name, email, dietary restrictions")
 * @param {string} [referenceContent] - Optional text from an uploaded document for context
 * @param {File|{ data: string, mimeType: string }} [referenceImage] - Optional image: File or { data: base64, mimeType } for Gemini vision
 * @returns {Promise<{ title: string, description?: string, fields: Array }>} Parsed form definition
 */
/**
 * @param {Array<{ id: string, name: string }>} [users] - Team members for resolving @ mentions to approver names
 */
export async function generateFormWithGemini(userDescription, referenceContent, referenceImage, users = []) {
  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    throw new Error('Missing Gemini API key. Add NEXT_PUBLIC_GEMINI_API_KEY (or VITE_GEMINI_API_KEY) in .env and restart.')
  }

  const hasReference = !!(referenceContent?.trim() || referenceImage)
  let userPrompt = ''

  if (referenceContent?.trim()) {
    userPrompt += `--- REFERENCE DOCUMENT (PRIMARY SOURCE - extract the form from this, do not invent): ---\n${referenceContent.trim()}\n--- End reference ---\n\nCreate the form by extracting fields and structure from the reference above. Use the exact labels and options you see. Do not add fields that are not in the reference.`
  }
  if (referenceImage) {
    userPrompt += (userPrompt ? '\n\n' : '') + 'CRITICAL: The attached image is your primary source. Extract every form field, label, and option you can see. Create the form from what is visible—do not invent or add fields not present in the image.'
  }
  if (!hasReference || userDescription.trim()) {
    userPrompt += (userPrompt ? '\n\n' : '') + (userDescription.trim() || 'A simple feedback form with name and message.')
  }
  if (users?.length > 0) {
    userPrompt += `\n\nAvailable team members (use exact names for approverNames): ${users.map((u) => u.name).join(', ')}`
  }

  const ai = new GoogleGenAI({ apiKey: apiKey.trim() })
  const systemWithOrg = `${getOrgContextForAI()}\n\n${FORM_GENERATION_SYSTEM}`

  const userParts = []
  if (referenceImage) {
    const { data, mimeType } =
      referenceImage instanceof File
        ? await fileToBase64(referenceImage)
        : { data: referenceImage.data, mimeType: referenceImage.mimeType || 'image/png' }
    userParts.push({ inlineData: { mimeType, data } })
  }
  userParts.push({ text: userPrompt })

  const response = await withRateLimitRetry(() =>
    ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: userParts }],
      config: {
        systemInstruction: systemWithOrg,
      },
    })
  )

  const text = response?.text
  if (text == null) {
    throw new Error('No text in Gemini response')
  }

  // Extract JSON from response (may be wrapped in ```json ... ```)
  let jsonStr = text.trim()
  const codeMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeMatch) jsonStr = codeMatch[1].trim()

  let parsed
  try {
    parsed = JSON.parse(jsonStr)
  } catch (parseErr) {
    if (/^["']?Sorry/i.test(jsonStr) || jsonStr.length < 100) {
      throw new Error(
        "The AI couldn't produce a valid form. If using a PDF, try a text-based PDF or an image/screenshot of the form instead. For image-based PDFs, take a screenshot and upload that."
      )
    }
    throw new Error(
      "The AI returned unexpected content. Please try again or rephrase your request. If using a reference document, ensure it has readable text (not a scanned/image-only PDF)."
    )
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid form structure from AI')
  }

  const title = String(parsed.title || 'Untitled form').trim()
  const description = parsed.description ? String(parsed.description).trim() : ''
  const layoutRaw = parsed.layout
  const layout =
    layoutRaw === 'header-cover' || layoutRaw === 'split' ? layoutRaw : 'default'
  const imagePrompt =
    parsed.imagePrompt && String(parsed.imagePrompt).trim()
      ? String(parsed.imagePrompt).trim()
      : null
  const submissionType =
    parsed.submissionType === 'event-request' ? 'event-request' : 'general'
  const approverNames = Array.isArray(parsed.approverNames) && parsed.approverNames.length > 0
    ? parsed.approverNames.map((n) => String(n).trim()).filter(Boolean)
    : null
  const rawFields = Array.isArray(parsed.fields) ? parsed.fields : []

  const validTypes = ['text', 'textarea', 'number', 'email', 'phone', 'date', 'datetime', 'yesno', 'dropdown', 'radio', 'checkbox', 'checklist', 'section', 'slider', 'attachment', 'signature', 'hidden']
  const fields = rawFields.map((f, idx) => {
    const type = validTypes.includes(f?.type) ? f.type : 'text'
    const label = f?.label ? String(f.label).trim() : (type === 'section' ? 'Section' : 'Untitled field')
    const field = {
      id: `f_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      label,
      required: Boolean(f?.required),
      placeholder: f?.placeholder ? String(f.placeholder) : '',
      colSpan: (type === 'section' || type === 'textarea') ? 2 : 1, // 2-col layout; sections/textareas full width
    }
    if (type === 'section') field.description = f?.description ? String(f.description) : ''
    if (['dropdown', 'radio', 'yesno', 'checklist'].includes(type)) {
      field.options = Array.isArray(f?.options) && f.options.length > 0
        ? f.options.map((o) => String(o))
        : type === 'yesno' ? ['Yes', 'No'] : ['Option 1', 'Option 2']
    }
    if (type === 'slider') field.validation = { min: 0, max: 100, step: 1 }
    if (type === 'email') field.validation = { email: true }
    if (type === 'phone') field.validation = { phone: true }
    if (f?.targetKey && typeof f.targetKey === 'string') {
      field.targetKey = String(f.targetKey).trim()
    }
    return field
  })

  return { title, description, fields, layout, imagePrompt, submissionType, approverNames }
}

/**
 * Generate an image from a text prompt using Gemini image model.
 * @param {string} prompt - Image description (e.g. "Professional header banner for a volunteer form")
 * @returns {Promise<string>} Base64 data URL (e.g. "data:image/png;base64,...") or empty string on failure
 */
export async function generateFormImageWithGemini(prompt) {
  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    throw new Error('Missing Gemini API key. Add NEXT_PUBLIC_GEMINI_API_KEY (or VITE_GEMINI_API_KEY) in .env and restart.')
  }

  const ai = new GoogleGenAI({ apiKey: apiKey.trim() })

  const response = await withRateLimitRetry(() =>
    ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: prompt.trim() || 'Professional form header banner with soft gradient',
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    })
  )

  const candidates = response?.candidates
  if (!candidates?.length) return ''
  const content = candidates[0]?.content
  if (!content?.parts?.length) return ''

  for (const part of content.parts) {
    if (part.inlineData?.data) {
      const mime = part.inlineData.mimeType || 'image/png'
      return `data:${mime};base64,${part.inlineData.data}`
    }
  }
  return ''
}
