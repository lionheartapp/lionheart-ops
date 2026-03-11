/**
 * AI Assistant Chatbot Types
 *
 * Types for the platform-wide AI assistant conversation,
 * tool calls, streaming events, and API request/response shapes.
 */

// ─── Conversation ─────────────────────────────────────────────────────────────

export interface ConversationTurn {
  role: 'user' | 'assistant'
  content: string
  timestamp: string // ISO 8601
  choices?: string[]     // tappable options below this message
  suggestions?: string[] // follow-up suggestion chips
}

// ─── API Request / Response ───────────────────────────────────────────────────

export interface ChatRequest {
  message: string
  conversationHistory: ConversationTurn[]
}

export interface ActionConfirmation {
  type: 'create_maintenance_ticket' | 'create_event' | 'create_it_ticket' | 'update_maintenance_ticket_status' | 'assign_maintenance_ticket'
  description: string
  payload: Record<string, unknown>
}

export interface ChatResponseData {
  available: boolean
  message: string
  conversationHistory: ConversationTurn[]
  actionConfirmation?: ActionConfirmation
}

// ─── Rich Confirmation Card (Plan 14-03 will use this for the card component) ─

export interface RichConfirmationCardData {
  title: string
  startDisplay: string     // e.g. "Friday, April 15 * 6:00 PM"
  endDisplay: string       // e.g. "9:00 PM"
  location?: string        // Room/location name
  description?: string
  resources?: Array<{
    name: string
    requested: number
    available: number      // -1 = unknown
    status: 'ok' | 'low' | 'unavailable'
  }>
  approvalChannels?: string[]  // e.g. ["Admin", "AV Production"]
}

// ─── Streaming Events (SSE) ──────────────────────────────────────────────────

export type StreamEvent =
  | { type: 'delta'; content: string }
  | { type: 'tool_start'; tool: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool: string; summary: string }
  | { type: 'action_confirmation'; action: ActionConfirmation }
  | { type: 'choices'; options: string[] }
  | { type: 'suggestions'; items: string[] }
  | { type: 'rich_confirmation'; card: RichConfirmationCardData }
  | { type: 'done'; conversationHistory: ConversationTurn[] }
  | { type: 'error'; message: string }
