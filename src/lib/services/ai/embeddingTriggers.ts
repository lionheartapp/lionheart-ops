/**
 * Embedding Triggers
 *
 * Fire-and-forget helpers that generate and store embeddings for
 * organizational records. Called from route POST handlers after
 * successful DB writes — never awaited, never throw.
 *
 * Pattern: sync function → internal async call with void + try/catch
 */

import { generateAndStoreEmbedding } from './embeddingService'
import { logger } from '@/lib/logger'

const log = logger.child({ module: 'embeddingTriggers' })

/**
 * Trigger async embedding generation for a ticket.
 * Fire-and-forget — does not affect the response time of the calling route.
 */
export function embedTicket(
  ticketId: string,
  ticket: {
    title: string
    description?: string | null
    category?: string | null
    priority?: string | null
  }
): void {
  const text = [ticket.title, ticket.description, ticket.category, ticket.priority]
    .filter(Boolean)
    .join(' ')
    .trim()

  void (async () => {
    try {
      await generateAndStoreEmbedding('Ticket', ticketId, text)
    } catch (err) {
      log.warn({ err, ticketId }, 'embedTicket failed')
    }
  })()
}

/**
 * Trigger async embedding generation for a calendar event.
 * Fire-and-forget — does not affect the response time of the calling route.
 */
export function embedCalendarEvent(
  eventId: string,
  event: {
    title: string
    description?: string | null
    locationText?: string | null
  }
): void {
  const text = [event.title, event.description, event.locationText]
    .filter(Boolean)
    .join(' ')
    .trim()

  void (async () => {
    try {
      await generateAndStoreEmbedding('CalendarEvent', eventId, text)
    } catch (err) {
      log.warn({ err, eventId }, 'embedCalendarEvent failed')
    }
  })()
}

/**
 * Trigger async embedding generation for an inventory item.
 * Fire-and-forget — does not affect the response time of the calling route.
 */
export function embedInventoryItem(
  itemId: string,
  item: {
    name: string
    description?: string | null
    category?: string | null
  }
): void {
  const text = [item.name, item.description, item.category]
    .filter(Boolean)
    .join(' ')
    .trim()

  void (async () => {
    try {
      await generateAndStoreEmbedding('InventoryItem', itemId, text)
    } catch (err) {
      log.warn({ err, itemId }, 'embedInventoryItem failed')
    }
  })()
}
