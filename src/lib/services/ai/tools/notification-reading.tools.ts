/**
 * AI Assistant — Notification Reading Tools
 *
 * Read-only tools for checking the current user's notifications.
 */

import { registerTools, type ToolRegistryEntry, type ToolContext } from './_registry'
import { getUserNotifications, getUnreadCount } from '@/lib/services/notificationService'

const tools: Record<string, ToolRegistryEntry> = {
  // ── GREEN: List My Notifications ────────────────────────────────────────
  list_my_notifications: {
    definition: {
      name: 'list_my_notifications',
      description:
        'List the current user\'s recent notifications. Use when someone asks "what did I miss?", "any updates?", "show my notifications", or similar.',
      parameters: {
        type: 'object',
        properties: {
          unread_only: { type: 'boolean', description: 'Only show unread notifications (default: false)' },
          limit: { type: 'number', description: 'Max notifications to return (default: 15, max: 30)' },
        },
        required: [],
      },
    },
    requiredPermission: null,
    riskTier: 'GREEN',
    execute: async (input, ctx) => {
      const limit = Math.min((input.limit as number) || 15, 30)

      const { notifications } = await getUserNotifications(ctx.userId, { limit })

      let filtered = notifications as any[]
      if (input.unread_only) {
        filtered = filtered.filter((n: any) => !n.isRead)
      }

      return JSON.stringify({
        notifications: filtered.map((n: any) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body || undefined,
          isRead: n.isRead,
          linkUrl: n.linkUrl || undefined,
          createdAt: n.createdAt,
        })),
        count: filtered.length,
        totalFetched: notifications.length,
      })
    },
  },

  // ── GREEN: Get Unread Count ─────────────────────────────────────────────
  get_unread_count: {
    definition: {
      name: 'get_unread_count',
      description:
        'Get the number of unread notifications for the current user. Quick check for "do I have any new notifications?"',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    requiredPermission: null,
    riskTier: 'GREEN',
    execute: async (input, ctx) => {
      const count = await getUnreadCount(ctx.userId)

      return JSON.stringify({
        unreadCount: count,
        message: count === 0
          ? 'You\'re all caught up — no unread notifications!'
          : `You have ${count} unread notification${count === 1 ? '' : 's'}.`,
      })
    },
  },
}

registerTools(tools)
