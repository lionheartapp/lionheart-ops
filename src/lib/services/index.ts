/**
 * Services Layer
 * 
 * All business logic and data operations go through services.
 * Services enforce:
 * - Input validation via Zod
 * - Organization scoping
 * - Role-based access control (RBAC)
 * - Consistent error handling
 * 
 * Rule: API routes ONLY call services. UI never calls DB directly.
 */

export * as eventService from './eventService'
export * as calendarService from './calendarService'
export * as recurrenceService from './recurrenceService'
export * as draftEventService from './draftEventService'
export * as ticketService from './ticketService'
export * as organizationService from './organizationService'
export * as organizationRegistrationService from './organizationRegistrationService'
export * from '@/lib/services/ai/gemini.service'
export * from '@/lib/services/operations/engine'

