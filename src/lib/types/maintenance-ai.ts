/**
 * Type definitions for AI-powered maintenance ticket diagnostics.
 *
 * AiAnalysisCache is stored in MaintenanceTicket.aiAnalysis (Json? field).
 * The cache structure allows:
 *   - Lazy diagnosis (only fetched when technician expands the panel)
 *   - Invalidation detection (compare lastPhotoSnapshot vs current photos)
 *   - Persistent conversation history per ticket
 */

export interface AiDiagnosis {
  likelyDiagnosis: string
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  confidenceReason: string
  suggestedTools: string[]
  suggestedParts: string[]
  steps: string[]
  analyzedPhotoCount: number
  analyzedAt: string // ISO timestamp
}

export interface AiConversationTurn {
  role: 'user' | 'assistant'
  content: string
  timestamp: string // ISO timestamp
}

export interface AiAnalysisCache {
  diagnosis: AiDiagnosis | null
  conversation: AiConversationTurn[]
  lastPhotoSnapshot: string[] // Copy of photos[] at time of analysis — for invalidation check
}
