/**
 * AI Assistant — Communication Domain Tools
 * New: send_notification, send_email
 */

import { registerTools, type ToolRegistryEntry } from './_registry'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'

const tools: Record<string, ToolRegistryEntry> = {
  send_notification: {
    definition: {
      name: 'send_notification',
      description: 'Send an in-app notification to a user. Executes immediately.',
      parameters: {
        type: 'object',
        properties: {
          recipient_name: { type: 'string', description: 'Name or email of the recipient' },
          title: { type: 'string', description: 'Notification title' },
          message: { type: 'string', description: 'Notification message body' },
        },
        required: ['recipient_name', 'title', 'message'],
      },
    },
    requiredPermission: null,
    riskTier: 'YELLOW',
    execute: async (input, ctx) => {
      const recipientName = String(input.recipient_name || '')
      const user = await prisma.user.findFirst({
        where: { OR: [{ name: { contains: recipientName, mode: 'insensitive' } }, { email: { contains: recipientName, mode: 'insensitive' } }] },
        select: { id: true, name: true },
      })
      if (!user) return JSON.stringify({ error: `Could not find user matching "${recipientName}".` })

      const { createNotification } = await import('@/lib/services/notificationService')
      await createNotification({
        userId: user.id,
        title: String(input.title || ''),
        body: String(input.message || ''),
        type: 'maintenance_submitted' as any, // Generic notification via maintenance type
      })

      return JSON.stringify({ executed: true, message: `Notification sent to ${user.name}.` })
    },
  },

  send_email: {
    definition: {
      name: 'send_email',
      description: 'Send an email to a user. Returns confirmation before sending.',
      parameters: {
        type: 'object',
        properties: {
          recipient_name: { type: 'string', description: 'Name or email of the recipient' },
          subject: { type: 'string', description: 'Email subject line' },
          message: { type: 'string', description: 'Email body text' },
        },
        required: ['recipient_name', 'subject', 'message'],
      },
    },
    requiredPermission: PERMISSIONS.USERS_INVITE,
    riskTier: 'ORANGE',
    execute: async (input) => {
      const recipientName = String(input.recipient_name || '')
      const user = await prisma.user.findFirst({
        where: { OR: [{ name: { contains: recipientName, mode: 'insensitive' } }, { email: { contains: recipientName, mode: 'insensitive' } }] },
        select: { id: true, name: true, email: true },
      })
      if (!user) return JSON.stringify({ error: `Could not find user matching "${recipientName}".` })

      const draft = {
        action: 'send_email',
        recipientId: user.id,
        recipientName: user.name,
        recipientEmail: user.email,
        subject: String(input.subject || ''),
        message: String(input.message || ''),
      }
      return JSON.stringify({
        confirmationRequired: true,
        message: `Send email to ${user.name} (${user.email})?\n• Subject: ${draft.subject}`,
        draft,
      })
    },
  },
}

registerTools(tools)
