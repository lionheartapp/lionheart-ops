/**
 * AI Assistant Chatbot Types
 *
 * Types for the platform-wide AI assistant conversation,
 * tool calls, streaming events, and API request/response shapes.
 */

// ─── Image Attachments ───────────────────────────────────────────────────────

export interface ImageAttachment {
  data: string    // base64-encoded image data (no data-URL prefix)
  mimeType: string
  name: string
}

// ─── Conversation ─────────────────────────────────────────────────────────────

export interface ConversationTurn {
  role: 'user' | 'assistant'
  content: string
  timestamp: string // ISO 8601
  choices?: string[]     // tappable options below this message
  suggestions?: string[] // follow-up suggestion chips
  images?: ImageAttachment[] // user-attached images (base64, not persisted)
}

// ─── API Request / Response ───────────────────────────────────────────────────

export interface ChatRequest {
  message: string
  conversationHistory: ConversationTurn[]
}

export interface ActionConfirmation {
  type: string // action name (e.g. 'create_maintenance_ticket', 'update_event', etc.)
  description: string
  payload: Record<string, unknown>
  riskTier?: 'ORANGE' | 'RED'
  riskWarning?: string
}

// ─── Workflow Types ───────────────────────────────────────────────────────────

export interface WorkflowStep {
  stepNumber: number
  tool: string
  description: string
  input: Record<string, unknown>
  status: 'pending' | 'running' | 'done' | 'failed'
  result?: string
}

export interface WorkflowPlan {
  title: string
  steps: WorkflowStep[]
  stepCount: number
}

export interface ChatResponseData {
  available: boolean
  message: string
  conversationHistory: ConversationTurn[]
  actionConfirmation?: ActionConfirmation
}

// ─── Rich Confirmation Cards ─────────────────────────────────────────────────

export interface RichConfirmationCardData {
  cardType?: 'event'       // discriminator (absent = event for backward compat)
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

export interface TicketConfirmationCardData {
  cardType: 'ticket'
  title: string
  category: string         // e.g. "PLUMBING", "ELECTRICAL"
  priority: string         // e.g. "URGENT", "HIGH", "MEDIUM", "LOW"
  location?: string
  description?: string
}

export type ConfirmationCardData = RichConfirmationCardData | TicketConfirmationCardData

// ─── Streaming Events (SSE) ──────────────────────────────────────────────────

export type StreamEvent =
  | { type: 'delta'; content: string }
  | { type: 'tool_start'; tool: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool: string; summary: string }
  | { type: 'action_confirmation'; action: ActionConfirmation }
  | { type: 'choices'; options: string[] }
  | { type: 'suggestions'; items: string[] }
  | { type: 'rich_confirmation'; card: ConfirmationCardData }
  | { type: 'workflow_plan'; plan: WorkflowPlan }
  | { type: 'workflow_step_start'; stepNumber: number; tool: string }
  | { type: 'workflow_step_complete'; stepNumber: number; result: string }
  | { type: 'workflow_step_failed'; stepNumber: number; error: string }
  | { type: 'workflow_complete'; summary: string }
  | { type: 'done'; conversationHistory: ConversationTurn[] }
  | { type: 'error'; message: string }
