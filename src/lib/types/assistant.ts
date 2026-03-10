/**
 * AI Assistant Chatbot Types
 *
 * Types for the platform-wide AI assistant conversation,
 * tool calls, and API request/response shapes.
 */

// ─── Conversation ─────────────────────────────────────────────────────────────

export interface ConversationTurn {
  role: 'user' | 'assistant'
  content: string
  timestamp: string // ISO 8601
}

// ─── API Request / Response ───────────────────────────────────────────────────

export interface ChatRequest {
  message: string
  conversationHistory: ConversationTurn[]
}

export interface ActionConfirmation {
  type: 'create_maintenance_ticket' | 'assign_ticket' | 'create_event'
  description: string
  payload: Record<string, unknown>
}

export interface ChatResponseData {
  available: boolean
  message: string
  conversationHistory: ConversationTurn[]
  actionConfirmation?: ActionConfirmation
}
