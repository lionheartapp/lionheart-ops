# Phase 14: AI Assistant UX Upgrade - Research

**Researched:** 2026-03-10
**Domain:** Conversational UI patterns, SSE streaming extensions, Gemini function calling, weather forecast API
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- Gemini remains the AI provider — no switch to Claude/Anthropic
- Existing tool execution functions (all `execute*` functions) stay unchanged
- Confirm route (`/api/ai/assistant/confirm/route.ts`) is not changed
- Voice input (`useSpeechRecognition` hook) is not changed
- `ChatButton` + `AiGlow` components are not changed
- Permission system, org-scoping, and all existing patterns remain
- Chat panel is 384px wide, 520px tall — all new UI must fit within this
- Buttons/chips use aurora gradient (`linear-gradient(90deg, #3B82F6 0%, #6366F1 100%)`) on hover
- Framer Motion for all animations (already in project)
- Card style: `bg-white border border-gray-200 rounded-xl`
- Glassmorphism classes: `ui-glass`, `ui-glass-hover`

### Claude's Discretion

- Exact animation timing and easing for button/chip entrance
- Chip scroll behavior on overflow (horizontal scroll vs wrap)
- Whether rich confirmation card replaces ActionConfirmation or extends it
- Exact tool parameter schemas for new tools
- How to handle weather API failures gracefully

### Deferred Ideas (OUT OF SCOPE)

- Form to AI handoff (user starts with AI, switches to form with pre-filled answers) — Phase 15+
- AI-generated knowledge base articles from resolved tickets — future
- Email reply integration for ticket threads — future
- Full automation engine (trigger to action) — separate phase
- RSVP/ticketing system for events — separate phase
- Visual workflow builder for approvals — separate phase
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AI-UX-01 | When Leo asks a question with choices, tappable button options appear below the message — clicking one sends that choice as a user message | SSE `choices` event type + `ChoiceButtons` component in `MessageList` |
| AI-UX-02 | After Leo responds with data, contextual suggestion chips appear — clicking one sends that suggestion | SSE `suggestions` event type + `SuggestionChips` component after last assistant message |
| AI-UX-03 | Asking "Is the gym available Friday at 7pm?" calls `check_room_availability` and returns yes/no with conflict details | New tool in `assistant-tools.ts` using exported `checkRoomConflict` from `eventService.ts` |
| AI-UX-04 | Asking "What's the weather for March 20?" calls `get_weather_forecast` and returns forecast data | New tool using Open-Meteo daily forecast API (date range parameters + `forecast_days` up to 16) |
| AI-UX-05 | Creating an event via Leo shows a rich confirmation card with editable fields, resource availability warnings, and approval chain preview | New `RichConfirmationCard` component + new SSE `rich_confirmation` event type |
</phase_requirements>

---

## Summary

Phase 14 upgrades the Leo AI assistant from a text-only chat to a rich conversational UI. The existing architecture (SSE streaming, Gemini function calling loop, tool registry, `ConversationTurn` types) is well-designed and can be extended cleanly. All changes fit in three layers: (1) new SSE event types emitted from the chat route, (2) new UI components that consume those events in `MessageList` and `ChatPanel`, and (3) new tool definitions added to `TOOL_REGISTRY` in `assistant-tools.ts`.

The marker-based approach (`[CHOICES: ...]`, `[SUGGEST: ...]`) decided in CONTEXT.md is the correct pattern here — it avoids LLM-specific structured output and works with Gemini's streaming response format. The streaming route already processes SSE line-by-line; parsing and stripping these markers from `delta` events is straightforward. The weather service already exists (`weatherService.ts`) but only handles current conditions; it needs an extension for daily forecasts using Open-Meteo's `start_date`/`end_date` parameters. Room availability checking has existing infrastructure (`checkRoomConflict` exported from `eventService.ts`).

The rich confirmation card for events (AI-UX-05) is the most complex piece. The existing `ActionConfirmation` component is a generic modal overlay; the new rich card should be a separate, more data-rich component that replaces it specifically for `create_event` confirmations. Other action types (`create_maintenance_ticket`, `update_maintenance_ticket_status`, etc.) can continue using the existing `ActionConfirmation` component.

**Primary recommendation:** Extend the existing SSE pipeline with three new event types, add three new components (ChoiceButtons, SuggestionChips, RichConfirmationCard), add four new tools to the registry, and update the system prompt with marker instructions.

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `framer-motion` | ^12.34.3 | Animations for buttons/chips/cards | Already in project, all existing animations use it |
| `@google/genai` | ^1.40.0 | Gemini streaming + function calling | Locked by CONTEXT.md |
| `next` | ^15.1.0 | App Router SSE via `ReadableStream` | Already in use |

### No New Dependencies Required

All UI patterns (Framer Motion stagger, AnimatePresence, aurora gradient) are already available. Open-Meteo weather API is free and already used. No new npm packages needed for this phase.

---

## Architecture Patterns

### Recommended File Changes

```
src/
  lib/
    types/
      assistant.ts           ← ADD: choices, suggestions, rich_confirmation to StreamEvent union
    services/
      ai/
        assistant-tools.ts   ← ADD: 4 new tools to TOOL_REGISTRY
        assistant.service.ts ← UPDATE: system prompt with [CHOICES:] and [SUGGEST:] instructions
      weatherService.ts      ← EXTEND: add fetchWeatherForecast(lat, lng, date) function
  app/
    api/
      ai/
        assistant/
          chat/route.ts      ← EXTEND: parse markers from delta stream, emit new SSE event types
  components/
    ai/
      MessageList.tsx        ← UPDATE: render ChoiceButtons + SuggestionChips
      ChoiceButtons.tsx      ← NEW: tappable pill buttons below assistant messages
      SuggestionChips.tsx    ← NEW: horizontal chip row after last assistant message
      RichConfirmationCard.tsx ← NEW: event creation rich card
      ChatPanel.tsx          ← UPDATE: pass onSendMessage to MessageList, handle rich_confirmation SSE event
```

### Pattern 1: Marker Parsing in SSE Stream

The chat route accumulates `delta` text chunks. Before emitting each `delta` event, the route scans the accumulated text for `[CHOICES: ...]` and `[SUGGEST: ...]` markers. When found, it strips them from the text (so they don't display as raw text to the user), emits the appropriate structured SSE event, and continues streaming the clean text.

**Key insight:** Markers should be parsed from the **complete accumulated text** at stream end (in the `done` handler), not during streaming — to avoid partial marker false positives (e.g., `[CHOICES: Opt` before the closing `]` arrives). Emit `choices`/`suggestions` SSE events only once, at stream completion alongside `done`.

```typescript
// Source: chat/route.ts extension pattern
// Parse markers from completed text, then strip before adding to history
function extractMarkers(text: string): {
  cleanText: string
  choices: string[]
  suggestions: string[]
} {
  let cleanText = text
  let choices: string[] = []
  let suggestions: string[] = []

  const choicesMatch = cleanText.match(/\[CHOICES:\s*([^\]]+)\]/)
  if (choicesMatch) {
    choices = choicesMatch[1].split('|').map(s => s.trim()).filter(Boolean)
    cleanText = cleanText.replace(choicesMatch[0], '').trim()
  }

  const suggestMatch = cleanText.match(/\[SUGGEST:\s*([^\]]+)\]/)
  if (suggestMatch) {
    suggestions = suggestMatch[1].split('|').map(s => s.trim()).filter(Boolean)
    cleanText = cleanText.replace(suggestMatch[0], '').trim()
  }

  return { cleanText, choices, suggestions }
}
```

### Pattern 2: Extended StreamEvent Types

```typescript
// Source: src/lib/types/assistant.ts — extend the union
export type StreamEvent =
  | { type: 'delta'; content: string }
  | { type: 'tool_start'; tool: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool: string; summary: string }
  | { type: 'action_confirmation'; action: ActionConfirmation }
  | { type: 'choices'; options: string[] }            // NEW
  | { type: 'suggestions'; items: string[] }          // NEW
  | { type: 'rich_confirmation'; card: RichConfirmationCard } // NEW
  | { type: 'done'; conversationHistory: ConversationTurn[] }
  | { type: 'error'; message: string }
```

### Pattern 3: ConversationTurn Extension

Store choices/suggestions on the turn so they persist in conversation history (they should disappear after user acts):

```typescript
// Source: src/lib/types/assistant.ts
export interface ConversationTurn {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  choices?: string[]     // NEW — tappable options after this message
  suggestions?: string[] // NEW — follow-up suggestion chips
  richCard?: RichConfirmationCardData // NEW — rich event confirmation
}
```

### Pattern 4: ChoiceButtons Component

```typescript
// Source: pattern aligned with existing Framer Motion usage in MessageList.tsx
'use client'

import { motion } from 'framer-motion'
import { staggerContainer, listItem } from '@/lib/animations'

interface ChoiceButtonsProps {
  options: string[]
  onSelect: (option: string) => void
  disabled?: boolean
}

export default function ChoiceButtons({ options, onSelect, disabled }: ChoiceButtonsProps) {
  return (
    <motion.div
      variants={staggerContainer(0.05)}
      initial="hidden"
      animate="visible"
      className="flex flex-wrap gap-2 mt-2"
    >
      {options.map((option) => (
        <motion.button
          key={option}
          variants={listItem}
          onClick={() => !disabled && onSelect(option)}
          disabled={disabled}
          className="px-3 py-1.5 text-xs font-medium rounded-full border border-blue-200
                     bg-blue-50 text-blue-700 hover:bg-blue-100
                     disabled:opacity-40 disabled:cursor-not-allowed
                     transition-colors duration-200 cursor-pointer
                     min-h-[44px] flex items-center"
          // Aurora gradient on hover via inline style or CSS
        >
          {option}
        </motion.button>
      ))}
    </motion.div>
  )
}
```

### Pattern 5: SuggestionChips Component

```typescript
// Horizontal scrollable row below the last assistant message
// Disappears when a new message is sent (controlled by ChatPanel)
export default function SuggestionChips({ items, onSelect }: SuggestionChipsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar"
    >
      {items.map((item) => (
        <button
          key={item}
          onClick={() => onSelect(item)}
          className="flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-full
                     bg-gray-100 text-gray-600 hover:bg-gray-200
                     transition-colors duration-200 cursor-pointer whitespace-nowrap"
        >
          {item}
        </button>
      ))}
    </motion.div>
  )
}
```

### Pattern 6: New Tools in TOOL_REGISTRY

Four new tools follow the same `ToolRegistryEntry` shape as existing tools:

```typescript
// check_room_availability — uses exported checkRoomConflict from eventService.ts
check_room_availability: {
  definition: {
    name: 'check_room_availability',
    description: 'Check if a specific room is available for a date and time range.',
    parameters: {
      type: 'object',
      properties: {
        room_name: { type: 'string', description: 'Room name or number to check' },
        start_datetime: { type: 'string', description: 'Start in ISO format (e.g. "2026-04-15T18:00:00")' },
        end_datetime: { type: 'string', description: 'End in ISO format (e.g. "2026-04-15T21:00:00")' },
      },
      required: ['room_name', 'start_datetime', 'end_datetime'],
    },
  },
  requiredPermission: null, // Room availability is public info
  execute: executeCheckRoomAvailability,
}
```

**IMPORTANT:** `checkRoomConflict` from `eventService.ts` is already exported and throws on conflict. The new tool wraps it in try/catch — conflict means unavailable, no throw means available.

### Pattern 7: Weather Forecast Tool

Open-Meteo supports `start_date`/`end_date` with daily parameters (`temperature_2m_max`, `temperature_2m_min`, `weather_code`, `precipitation_probability_max`). The tool calls a new `fetchWeatherForecast(lat, lng, date)` function in `weatherService.ts`:

```typescript
// Extension to weatherService.ts
export interface WeatherForecastDay {
  date: string          // YYYY-MM-DD
  tempMax: number       // Fahrenheit
  tempMin: number       // Fahrenheit
  condition: string
  icon: string
  precipitationChance: number // 0-100%
}

export async function fetchWeatherForecast(
  lat: number,
  lng: number,
  targetDate: string // YYYY-MM-DD
): Promise<WeatherForecastDay | null> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', lat.toString())
  url.searchParams.set('longitude', lng.toString())
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max')
  url.searchParams.set('temperature_unit', 'celsius')
  url.searchParams.set('start_date', targetDate)
  url.searchParams.set('end_date', targetDate)
  url.searchParams.set('timezone', 'America/Los_Angeles') // Use org timezone if available
  // ...
}
```

**Key insight for weather tool:** The tool needs lat/lng — but the AI assistant doesn't know the org's coordinates. The tool should look up the `Organization.latitude` and `Organization.longitude` fields (already in schema) via `rawPrisma`. If coordinates are null, fall back to a message like "I don't have location data for your organization — try asking for [City] weather."

### Pattern 8: RichConfirmationCard Component

The rich card replaces the existing `ActionConfirmation` overlay specifically for `create_event`. It is a separate component, not a modification of `ActionConfirmation`. `ChatPanel` checks if `pendingAction.type === 'create_event'` and renders `RichConfirmationCard` instead of `ActionConfirmation`.

The card data type:

```typescript
export interface RichConfirmationCardData {
  title: string
  startDisplay: string    // "Friday, April 15 • 6:00 PM"
  endDisplay: string      // "9:00 PM"
  location?: string
  resources?: Array<{
    name: string
    requested: number
    available: number     // -1 = unknown
    status: 'ok' | 'low' | 'unavailable'
  }>
  approvalChannels?: string[]  // ["Admin", "AV Production"]
}
```

The `executeCreateEventDraft` function in `assistant-tools.ts` is extended to query:
1. `ApprovalChannelConfig` for the org to determine which approval channels are REQUIRED
2. `InventoryItem` quantities for any resources mentioned in the event description

### Pattern 9: System Prompt Update

Add to `buildSystemPrompt()` in `assistant.service.ts`:

```
## Structured Response Formats

When asking the user to choose between options, append this EXACTLY at the end of your response:
[CHOICES: Option A | Option B | Option C]
Use this for: event type selection, priority selection, category selection, yes/no questions.
Maximum 6 options. Keep labels short (1-4 words).

After providing a data response (stats, search results, event lists), append follow-up suggestions:
[SUGGEST: Suggestion 1 | Suggestion 2 | Suggestion 3]
Use this when there are obvious next steps. Maximum 4 suggestions.

Do NOT use both [CHOICES:] and [SUGGEST:] in the same response.
Do NOT use these markers in confirmations or error messages.
```

### Anti-Patterns to Avoid

- **Parsing markers mid-stream:** Scan the complete accumulated text at stream end, not during individual delta chunks. A marker like `[CHOICES: Chapel | Athletic` could arrive in two separate chunks.
- **Mutating ConversationTurn objects directly:** Always create new objects with spread (`{ ...turn, choices: [] }`).
- **Passing `handleSendMessage` to `MessageList` as prop:** Instead, pass it via `onChoiceSelect` and `onSuggestionSelect` props. Keeps MessageList focused.
- **Global suggestion chips state in ChatPanel:** Keep active suggestions on the `ConversationTurn` object. Clear by replacing with `{ ...turn, suggestions: [] }` when a new user message is sent.
- **Weather tool failing silently:** Always return a user-friendly message when `fetchWeatherForecast` returns null. Never let the AI receive `null` as a tool result.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Room conflict check | Custom query | `checkRoomConflict` exported from `eventService.ts` | Already handles edge cases: timezone, cancelled events, case-insensitive matching |
| Weather forecast | Own weather API integration | Open-Meteo (already in `weatherService.ts`) | Free, no key, already integrated, reliable |
| Animation variants | Custom CSS keyframes | `staggerContainer`, `listItem`, `fadeInUp` from `src/lib/animations.ts` | Project-standard, consistent easing |
| SSE encoding | Custom encoder | Existing `sseEvent()` helper in `chat/route.ts` | Already handles JSON serialization and `data: ` prefix format |
| Permission gating | Custom auth check | `ToolRegistryEntry.requiredPermission` field | All tools go through `executeTool()` which enforces `can()` check |

**Key insight:** All infrastructure for this phase already exists — the work is purely extending existing clean abstractions, not building new systems.

---

## Common Pitfalls

### Pitfall 1: Partial Marker Splits Across SSE Chunks

**What goes wrong:** Gemini streams text in chunks. `[CHOICES: Chapel |` may arrive in chunk 1 and `Athletic Event]` in chunk 2. If you scan for markers on each delta, you'll never find complete markers.

**Why it happens:** SSE streaming delivers incomplete text segments.

**How to avoid:** Scan for markers only on the complete accumulated `finalText` at the end of the streaming loop, before emitting the `done` event. The delta events show the raw text to the user in real-time; marker removal and structured events come at the end.

**Warning signs:** Choices/suggestions appearing inconsistently, or `[CHOICES:` leaking into the displayed message text.

### Pitfall 2: Choices Persisting After User Responds

**What goes wrong:** User types a reply manually (not clicking a choice button), but the choice buttons remain visible below the old assistant message.

**Why it happens:** Choices are stored on the `ConversationTurn` object and not cleared when the user sends a new message.

**How to avoid:** In `handleSendMessage` in `ChatPanel`, before appending the new user turn, update the previous assistant turn to have `choices: undefined`. Or use a separate `activeChoices` state that gets cleared on every `handleSendMessage` call.

**Warning signs:** Choice buttons remain clickable after a new message exchange has started.

### Pitfall 3: Suggestions Showing After Every Message

**What goes wrong:** Leo returns `[SUGGEST: ...]` after every single response, even simple one-liners like "Got it!" — filling the chat with irrelevant chips.

**Why it happens:** System prompt instructions are too permissive.

**How to avoid:** Be specific in the system prompt: "Only use [SUGGEST:] after data responses (statistics, lists, search results) or after completing an action. Never use it for conversational acknowledgements."

**Warning signs:** Suggestion chips appear after "I don't know" or "Sure!" responses.

### Pitfall 4: Weather Tool Has No Location Data

**What goes wrong:** `get_weather_forecast` tool is called but the org has null lat/lng in the `Organization` table. `fetchWeatherForecast` returns null. Tool returns an unhelpful empty response.

**Why it happens:** Organization location is optional — many orgs don't set coordinates.

**How to avoid:** The tool execution function should check for null coordinates first and return a friendly message: `{"error": "Location data not configured for your organization. You can ask for weather by city name: 'What's the weather in Portland on March 20?'"}`. Accept an optional `city` parameter in the tool and use a geocoding fallback if coordinates are missing.

**Warning signs:** Gemini receives `null` or empty result from weather tool and hallucinates a weather report.

### Pitfall 5: Rich Confirmation Card Breaking Existing Confirm Flow

**What goes wrong:** The `create_event` tool now returns rich card data. The existing `ActionConfirmation` component doesn't know how to render it. Both components try to render at the same time.

**Why it happens:** `pendingAction` state in `ChatPanel` is checked in one place but two components read it.

**How to avoid:** In `ChatPanel`, use a conditional: `if (pendingAction?.type === 'create_event') render <RichConfirmationCard>; else render <ActionConfirmation>`. The `RichConfirmationCard` still calls the same `handleConfirmAction`/`handleCancelAction` callbacks — no changes to the confirm API route.

**Warning signs:** TypeScript errors on `pendingAction.type` — add `'create_event'` with rich card data type to the `ActionConfirmation` union.

### Pitfall 6: `checkRoomConflict` Runs in Wrong Org Context

**What goes wrong:** `check_room_availability` tool calls `checkRoomConflict` but it runs inside `executeTool()` which is called inside `runWithOrgContext(orgId, ...)` — this is correct. But if you call it outside that context, the org-scoped `prisma` client returns wrong results.

**Why it happens:** Org-scoped Prisma extension uses `AsyncLocalStorage` — the context must be active on the same async call stack.

**How to avoid:** All tool execution already happens inside `runWithOrgContext` in `chat/route.ts`. Never call tool executors directly outside that wrapper.

---

## Code Examples

Verified patterns from existing codebase:

### SSE Event Emission (existing pattern to extend)
```typescript
// Source: src/app/api/ai/assistant/chat/route.ts lines 50-52, 118-121
function sseEvent(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

// In the stream start():
const write = (event: StreamEvent) => {
  controller.enqueue(encoder.encode(sseEvent(event)))
}

// EXTEND: emit new events at end of finalText processing:
const { cleanText, choices, suggestions } = extractMarkers(finalText)
finalText = cleanText
if (choices.length > 0) write({ type: 'choices', options: choices })
if (suggestions.length > 0) write({ type: 'suggestions', items: suggestions })
```

### Framer Motion Stagger (existing pattern)
```typescript
// Source: src/lib/animations.ts
import { staggerContainer, listItem } from '@/lib/animations'

<motion.div variants={staggerContainer(0.05)} initial="hidden" animate="visible">
  {options.map(opt => (
    <motion.button key={opt} variants={listItem}>{opt}</motion.button>
  ))}
</motion.div>
```

### Open-Meteo Daily Forecast API (new, HIGH confidence from official docs)
```typescript
// Fetch daily forecast for a specific date
const url = new URL('https://api.open-meteo.com/v1/forecast')
url.searchParams.set('latitude', '45.52')
url.searchParams.set('longitude', '-122.68')
url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max')
url.searchParams.set('temperature_unit', 'celsius')
url.searchParams.set('start_date', '2026-03-20')  // ISO format
url.searchParams.set('end_date', '2026-03-20')
url.searchParams.set('timezone', 'America/Los_Angeles')
// Response: { daily: { time: ['2026-03-20'], temperature_2m_max: [18.2], ... } }
```

### checkRoomConflict Usage (existing pattern to reuse)
```typescript
// Source: src/lib/services/eventService.ts (exported at line 69)
import { checkRoomConflict } from '@/lib/services/eventService'

// In executeCheckRoomAvailability tool:
try {
  await checkRoomConflict(roomName, new Date(startDatetime), new Date(endDatetime))
  return JSON.stringify({ available: true, room: roomName, message: `${roomName} is available` })
} catch (err: any) {
  if (err.code === 'ROOM_CONFLICT') {
    return JSON.stringify({ available: false, room: roomName, conflict: err.message })
  }
  throw err
}
```

### Aurora Gradient Hover (existing pattern from MEMORY.md)
```typescript
// CSS for aurora gradient hover on buttons/chips
// Use background-image with transition via group/peer if needed
// Or use Tailwind JIT arbitrary value:
className="hover:bg-gradient-to-r hover:from-blue-500 hover:to-indigo-600 hover:text-white"
// Or inline style on hover (via useState):
const [hovered, setHovered] = useState(false)
style={hovered ? { background: 'linear-gradient(90deg, #3B82F6 0%, #6366F1 100%)', color: 'white' } : {}}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Plain text confirmation | `ActionConfirmation` modal overlay | Already shipped | Rich card extends this pattern |
| No structured choices | `[CHOICES:]` marker parsing | Phase 14 (new) | Typeform-style interactivity without LLM API changes |
| Current-only weather | Daily forecast support | Phase 14 (new) | Enables event planning with weather context |
| Text-only tool results | Room/resource availability tools | Phase 14 (new) | Answers "Is X available?" directly |

**What already exists that is relevant:**
- `checkRoomConflict` — exported from `eventService.ts`, handles all edge cases (timezone, cancelled events, case-insensitive)
- `fetchWeather` — `weatherService.ts` handles current conditions; needs a sibling function for forecasts
- `EventResourceRequest` + `resourceRequestService.ts` — for checking resource availability
- `ApprovalChannelConfig` — for querying required approvals (used in rich confirmation card)
- `Organization.latitude`/`.longitude` — for weather location lookup

---

## Validation Architecture

`nyquist_validation` is enabled in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None installed (no Vitest in devDependencies as of research) |
| Config file | None — Wave 0 gap |
| Quick run command | `npm run smoke:all` (integration smoke tests) |
| Full suite command | `npm run smoke:all` |

**Note:** Vitest is a v2.0 milestone requirement (INFRA-01) tracked in Phase 13, but not yet installed. Phase 14 tests should use the existing smoke test pattern (`.mjs` scripts hitting live API) for integration-level validation, and manual browser testing for UI components.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AI-UX-01 | Choice buttons appear and send message on click | manual UI | Visual inspection in browser | N/A |
| AI-UX-02 | Suggestion chips appear after data responses | manual UI | Visual inspection in browser | N/A |
| AI-UX-03 | `check_room_availability` returns correct yes/no | smoke/integration | `node scripts/smoke-ai-assistant.mjs` | ❌ Wave 0 |
| AI-UX-04 | `get_weather_forecast` returns forecast data | smoke/integration | `node scripts/smoke-ai-assistant.mjs` | ❌ Wave 0 |
| AI-UX-05 | Rich confirmation card renders for create_event | manual UI | Visual inspection in browser | N/A |

### Sampling Rate

- **Per task commit:** Manual browser test of affected component
- **Per wave merge:** `npm run smoke:all` + manual chat panel walkthrough
- **Phase gate:** All 5 AI-UX requirements visually verified before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `scripts/smoke-ai-assistant.mjs` — covers AI-UX-03 and AI-UX-04 (room availability + weather tool calls)

Note: UI component tests (AI-UX-01, AI-UX-02, AI-UX-05) are manual-only because Next.js client components require a browser environment and Vitest is not yet installed in this project.

---

## Open Questions

1. **Organization coordinates for weather**
   - What we know: `Organization.latitude` and `Organization.longitude` exist in schema (nullable floats)
   - What's unclear: How many orgs have these populated? If null, should the tool accept a city name parameter?
   - Recommendation: Accept optional `city` parameter in `get_weather_forecast` tool. If lat/lng is null AND city is not provided, return a friendly error explaining the limitation. If city is provided but no geocoding service is available, instruct Leo to ask the user for more specific location.

2. **find_available_rooms tool scope**
   - What we know: CONTEXT.md lists `find_available_rooms` as a new tool (find rooms matching capacity/campus)
   - What's unclear: Should this check actual room availability for a time slot, or just list rooms by criteria?
   - Recommendation: Implement as "list rooms matching criteria" (capacity, campus filter) without conflict checking. For conflict checking at a specific time, use `check_room_availability`. Keeps tools focused.

3. **Rich confirmation card "Edit" functionality**
   - What we know: CONTEXT.md spec shows "Edit" buttons per field
   - What's unclear: When user clicks "Edit" on location field, does it re-open the AI chat, or show an inline text input?
   - Recommendation: Inline text input per field. The card manages its own local state. When confirmed, the updated payload goes to `/api/ai/assistant/confirm`. Avoids re-triggering the AI conversation.

---

## Sources

### Primary (HIGH confidence)

- Open-Meteo official documentation (https://open-meteo.com/en/docs) — daily forecast parameters, date range, `start_date`/`end_date` format, `forecast_days` up to 16
- Project source code (read directly): `assistant-tools.ts`, `chat/route.ts`, `ChatPanel.tsx`, `MessageList.tsx`, `assistant.service.ts`, `types/assistant.ts`, `weatherService.ts`, `eventService.ts` (checkRoomConflict), `animations.ts`, `ActionConfirmation.tsx`
- Project schema (`prisma/schema.prisma`) — `Room`, `InventoryItem`, `EventResourceRequest`, `ApprovalChannelConfig`, `Organization.latitude/longitude`

### Secondary (MEDIUM confidence)

- Framer Motion v12 stagger patterns — verified against existing usage in `animations.ts` and components
- Gemini `@google/genai` 1.40.0 streaming format — verified against existing `chat/route.ts` implementation

### Tertiary (LOW confidence)

- Organization lat/lng population rate — assumed from schema definition, not verified with actual data

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use, versions confirmed via `package.json`
- Architecture: HIGH — full source code read, patterns extracted from working implementation
- New tool patterns: HIGH — follow identical structure to existing 12 tools
- Weather forecast: HIGH — verified against Open-Meteo official docs
- Pitfalls: HIGH — identified from actual code structure, not hypothetical

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable domain — Gemini, Open-Meteo, Framer Motion APIs are stable)
