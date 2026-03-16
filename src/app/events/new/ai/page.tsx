'use client'

import { AIEventWizard } from '@/components/events/ai/AIEventWizard'

/**
 * /events/new/ai
 *
 * AI event creation wizard — chat-style interface where staff describe an event
 * in natural language and AI auto-fills all event details.
 *
 * Authentication is enforced by the middleware (JWT required).
 * Permission check (EVENT_PROJECT_CREATE) is enforced by the API route.
 */
export default function AIEventCreationPage() {
  return <AIEventWizard />
}
