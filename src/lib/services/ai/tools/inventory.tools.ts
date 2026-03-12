/**
 * AI Assistant — Inventory Domain Tools
 *
 * Existing: check_resource_availability
 * New:      create_inventory_item, update_inventory_item, checkout_inventory, checkin_inventory
 */

import { registerTools, type ToolRegistryEntry } from './_registry'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'

const tools: Record<string, ToolRegistryEntry> = {
  // ── GREEN: Check Resource Availability ───────────────────────────────────
  check_resource_availability: {
    definition: {
      name: 'check_resource_availability',
      description: 'Check if an inventory item is available and its current stock level.',
      parameters: {
        type: 'object',
        properties: {
          item_name: { type: 'string', description: 'Name or partial name of the inventory item to check' },
        },
        required: ['item_name'],
      },
    },
    requiredPermission: null,
    riskTier: 'GREEN',
    execute: async (input) => {
      const itemName = String(input.item_name || '').trim()
      if (!itemName) return JSON.stringify({ error: 'Item name is required.' })

      const items = await prisma.inventoryItem.findMany({
        where: { name: { contains: itemName, mode: 'insensitive' } },
        select: { id: true, name: true, quantityOnHand: true, reorderThreshold: true, category: true },
        take: 5,
      })
      if (items.length === 0) return JSON.stringify({ found: false, message: `No inventory items matching "${itemName}" found.` })

      return JSON.stringify({
        found: true,
        items: items.map(item => ({
          name: item.name, category: item.category, available: item.quantityOnHand,
          reorderThreshold: item.reorderThreshold, lowStock: item.quantityOnHand <= item.reorderThreshold,
        })),
        count: items.length,
      })
    },
  },

  // ── ORANGE: Create Inventory Item ────────────────────────────────────────
  create_inventory_item: {
    definition: {
      name: 'create_inventory_item',
      description: 'Create a new inventory item. Returns confirmation before executing.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Item name' },
          category: { type: 'string', description: 'Category (e.g. "AV Equipment", "Furniture", "Supplies")' },
          quantity: { type: 'number', description: 'Initial quantity on hand' },
          reorder_threshold: { type: 'number', description: 'Low-stock alert threshold (default: 5)' },
        },
        required: ['name', 'category', 'quantity'],
      },
    },
    requiredPermission: PERMISSIONS.INVENTORY_CREATE,
    riskTier: 'ORANGE',
    execute: async (input) => {
      const draft = {
        action: 'create_inventory_item',
        name: String(input.name || ''),
        category: String(input.category || ''),
        quantityOnHand: Number(input.quantity) || 0,
        reorderThreshold: Number(input.reorder_threshold) || 5,
      }
      return JSON.stringify({
        confirmationRequired: true,
        message: `Create inventory item:\n• ${draft.name}\n• Category: ${draft.category}\n• Quantity: ${draft.quantityOnHand}\n• Reorder at: ${draft.reorderThreshold}`,
        draft,
      })
    },
  },

  // ── ORANGE: Update Inventory Item ────────────────────────────────────────
  update_inventory_item: {
    definition: {
      name: 'update_inventory_item',
      description: 'Update an inventory item\'s details. Returns confirmation before executing.',
      parameters: {
        type: 'object',
        properties: {
          item_name: { type: 'string', description: 'Name of the item to update' },
          new_name: { type: 'string', description: 'New name (optional)' },
          category: { type: 'string', description: 'New category (optional)' },
          quantity: { type: 'number', description: 'New quantity (optional)' },
          reorder_threshold: { type: 'number', description: 'New reorder threshold (optional)' },
        },
        required: ['item_name'],
      },
    },
    requiredPermission: PERMISSIONS.INVENTORY_UPDATE,
    riskTier: 'ORANGE',
    execute: async (input) => {
      const itemName = String(input.item_name || '')
      const item = await prisma.inventoryItem.findFirst({
        where: { name: { contains: itemName, mode: 'insensitive' } },
        select: { id: true, name: true },
      })
      if (!item) return JSON.stringify({ error: `Inventory item not found: "${itemName}"` })

      const changes: string[] = []
      if (input.new_name) changes.push(`Name → "${input.new_name}"`)
      if (input.category) changes.push(`Category → ${input.category}`)
      if (input.quantity !== undefined) changes.push(`Quantity → ${input.quantity}`)
      if (input.reorder_threshold !== undefined) changes.push(`Reorder threshold → ${input.reorder_threshold}`)
      if (changes.length === 0) return JSON.stringify({ error: 'No changes specified.' })

      const draft = {
        action: 'update_inventory_item',
        itemId: item.id,
        itemName: item.name,
        ...(input.new_name ? { name: String(input.new_name) } : {}),
        ...(input.category ? { category: String(input.category) } : {}),
        ...(input.quantity !== undefined ? { quantityOnHand: Number(input.quantity) } : {}),
        ...(input.reorder_threshold !== undefined ? { reorderThreshold: Number(input.reorder_threshold) } : {}),
      }

      return JSON.stringify({
        confirmationRequired: true,
        message: `Update "${item.name}":\n${changes.map(c => `• ${c}`).join('\n')}`,
        draft,
      })
    },
  },

  // ── YELLOW: Checkout Inventory ───────────────────────────────────────────
  checkout_inventory: {
    definition: {
      name: 'checkout_inventory',
      description: 'Check out an inventory item (reduce quantity). Executes immediately.',
      parameters: {
        type: 'object',
        properties: {
          item_name: { type: 'string', description: 'Name of the item to check out' },
          quantity: { type: 'number', description: 'Quantity to check out (default: 1)' },
          checked_out_to: { type: 'string', description: 'Name of the person or event checking out the item' },
        },
        required: ['item_name'],
      },
    },
    requiredPermission: PERMISSIONS.INVENTORY_CHECKOUT,
    riskTier: 'YELLOW',
    execute: async (input, ctx) => {
      const itemName = String(input.item_name || '')
      const quantity = Math.max(Number(input.quantity) || 1, 1)

      const item = await prisma.inventoryItem.findFirst({
        where: { name: { contains: itemName, mode: 'insensitive' } },
        select: { id: true, name: true, quantityOnHand: true },
      })
      if (!item) return JSON.stringify({ error: `Inventory item not found: "${itemName}"` })
      if (item.quantityOnHand < quantity) {
        return JSON.stringify({ error: `Not enough stock. "${item.name}" only has ${item.quantityOnHand} available.` })
      }

      const { checkoutItem } = await import('@/lib/services/inventoryService')
      await checkoutItem(ctx.organizationId, item.id, {
        quantity,
        checkedOutTo: String(input.checked_out_to || ''),
      }, ctx.userId)

      return JSON.stringify({
        executed: true,
        message: `Checked out ${quantity}x ${item.name}. Remaining: ${item.quantityOnHand - quantity}.`,
      })
    },
  },

  // ── YELLOW: Checkin Inventory ────────────────────────────────────────────
  checkin_inventory: {
    definition: {
      name: 'checkin_inventory',
      description: 'Check in / return an inventory item (increase quantity). Executes immediately.',
      parameters: {
        type: 'object',
        properties: {
          item_name: { type: 'string', description: 'Name of the item to check in' },
          quantity: { type: 'number', description: 'Quantity to check in (default: 1)' },
        },
        required: ['item_name'],
      },
    },
    requiredPermission: PERMISSIONS.INVENTORY_CHECKIN,
    riskTier: 'YELLOW',
    execute: async (input, ctx) => {
      const itemName = String(input.item_name || '')
      const quantity = Math.max(Number(input.quantity) || 1, 1)

      const item = await prisma.inventoryItem.findFirst({
        where: { name: { contains: itemName, mode: 'insensitive' } },
        select: { id: true, name: true, quantityOnHand: true },
      })
      if (!item) return JSON.stringify({ error: `Inventory item not found: "${itemName}"` })

      const { checkinItem } = await import('@/lib/services/inventoryService')
      await checkinItem(ctx.organizationId, { itemId: item.id, quantity }, ctx.userId)

      return JSON.stringify({
        executed: true,
        message: `Checked in ${quantity}x ${item.name}. New total: ${item.quantityOnHand + quantity}.`,
      })
    },
  },
}

registerTools(tools)
