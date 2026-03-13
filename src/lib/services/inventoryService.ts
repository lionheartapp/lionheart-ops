/**
 * Inventory Service
 *
 * Business logic for inventory management — CRUD, checkout/checkin with atomic
 * quantity updates, transaction log queries, and low-stock alert dispatch.
 *
 * All functions operate inside runWithOrgContext for proper org scoping.
 * Low-stock notification is fire-and-forget — never throws.
 */

import { z } from 'zod'
import { prisma, rawPrisma } from '@/lib/db'
import { runWithOrgContext } from '@/lib/org-context'
import { createBulkNotifications } from '@/lib/services/notificationService'
import { PERMISSIONS } from '@/lib/permissions'
import { stripAllHtml } from '@/lib/sanitize'
import { INVENTORY_CATEGORIES, AV_EQUIPMENT_TAGS } from '@/lib/constants/inventory'

// Re-export for backward compatibility with server-side consumers
export { INVENTORY_CATEGORIES, AV_EQUIPMENT_TAGS }

// ─── Zod Schemas ────────────────────────────────────────────────────────────

export const CreateItemSchema = z.object({
  name: z.string().min(1).max(200).transform(stripAllHtml),
  category: z.string().optional(),
  sku: z.string().max(100).optional(),
  quantityOnHand: z.number().int().min(0).default(0),
  reorderThreshold: z.number().int().min(0).default(0),
})

export const UpdateItemSchema = CreateItemSchema.partial()

export const CheckoutSchema = z.object({
  quantity: z.number().int().min(1),
  dueDate: z.string().datetime().optional(),
  notes: z
    .string()
    .optional()
    .transform((v) => (v ? stripAllHtml(v) : v)),
})

export const CheckinSchema = z.object({
  transactionId: z.string().min(1),
  notes: z
    .string()
    .optional()
    .transform((v) => (v ? stripAllHtml(v) : v)),
})

export type CreateItemInput = z.input<typeof CreateItemSchema>
export type UpdateItemInput = z.input<typeof UpdateItemSchema>
export type CheckoutInput = z.input<typeof CheckoutSchema>
export type CheckinInput = z.input<typeof CheckinSchema>

// ─── AV Equipment Schemas ───────────────────────────────────────────────────

export const AVLocationEntrySchema = z.object({
  id: z.string(),
  quantity: z.number().int().min(1),
  locationId: z.string().nullable().optional(),
  locationName: z.string().default(''),
  usage: z.string().optional().default(''),
})

export const AVDocLinkSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  title: z.string().min(1).max(200),
  type: z.enum(['manual', 'spec_sheet', 'warranty', 'other']),
})

export const CreateAVEquipmentSchema = z.object({
  // Step 1 — Essentials
  name: z.string().min(1).max(200).transform(stripAllHtml),
  description: z.string().max(2000).optional().transform((v) => (v ? stripAllHtml(v) : v)),
  ownerId: z.string().nullable().optional(),
  locations: z.array(AVLocationEntrySchema).default([]),
  allowCheckout: z.boolean().default(false),
  category: z.string().optional(),
  // Step 2 — Details
  manufacturer: z.string().max(200).optional().transform((v) => (v ? stripAllHtml(v) : v)),
  model: z.string().max(200).optional().transform((v) => (v ? stripAllHtml(v) : v)),
  serialNumbers: z.array(z.string().max(100)).default([]),
  imageUrl: z.string().optional().nullable(),
  documentationLinks: z.array(AVDocLinkSchema).default([]),
  tags: z.array(z.string()).default([]),
})

export const UpdateAVEquipmentSchema = CreateAVEquipmentSchema.partial()

export type CreateAVEquipmentInput = z.input<typeof CreateAVEquipmentSchema>
export type UpdateAVEquipmentInput = z.input<typeof UpdateAVEquipmentSchema>
export type AVLocationEntry = z.infer<typeof AVLocationEntrySchema>
export type AVDocLink = z.infer<typeof AVDocLinkSchema>

// ─── Private Helpers ────────────────────────────────────────────────────────

/**
 * Convert a permission string like "inventory:update" into Prisma where clauses.
 */
function permissionToWhere(
  perm: string
): Array<{ resource: string; action: string; scope?: string }> {
  const parts = perm.split(':')
  const resource = parts[0] || ''
  const action = parts[1] || ''
  const scope = parts[2]

  if (scope) {
    return [{ resource, action, scope }]
  }
  return [{ resource, action, scope: 'global' }]
}

/**
 * Get all users in an org who have a specific permission.
 * Uses rawPrisma to bypass org scoping.
 */
async function getUsersWithPermission(
  orgId: string,
  permission: string
): Promise<{ id: string; email: string; firstName: string; lastName: string }[]> {
  const users = await rawPrisma.user.findMany({
    where: {
      organizationId: orgId,
      deletedAt: null,
      userRole: {
        permissions: {
          some: {
            permission: {
              OR: [
                { resource: '*', action: '*' }, // super-admin wildcard
                ...permissionToWhere(permission),
              ],
            },
          },
        },
      },
    },
    select: { id: true, email: true, firstName: true, lastName: true },
  })
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    firstName: u.firstName ?? '',
    lastName: u.lastName ?? '',
  }))
}

/**
 * Fire-and-forget low-stock notification.
 * Notifies all users with INVENTORY_UPDATE permission that an item is below threshold.
 */
async function notifyLowStock(
  orgId: string,
  itemName: string,
  currentQty: number,
  itemId: string
): Promise<void> {
  try {
    const users = await getUsersWithPermission(orgId, PERMISSIONS.INVENTORY_UPDATE)
    if (users.length === 0) return

    await createBulkNotifications(
      users.map((u) => ({
        userId: u.id,
        type: 'inventory_low_stock' as const,
        title: `Low stock: ${itemName}`,
        body: `Only ${currentQty} unit(s) remaining — below reorder threshold`,
        linkUrl: `/inventory?highlight=${itemId}`,
      }))
    )
  } catch (err) {
    console.error('[InventoryService] notifyLowStock failed:', err)
  }
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

/**
 * List inventory items for an org, with optional search, category, and pagination.
 */
export async function listItems(
  orgId: string,
  filters?: { search?: string; category?: string; categories?: string[]; skip?: number; take?: number }
) {
  return runWithOrgContext(orgId, async () => {
    const where: Record<string, unknown> = {}
    if (filters?.search) {
      where.name = { contains: filters.search, mode: 'insensitive' }
    }
    if (filters?.categories && filters.categories.length > 0) {
      where.category = { in: filters.categories }
    } else if (filters?.category) {
      where.category = filters.category
    }
    return prisma.inventoryItem.findMany({
      where,
      orderBy: { name: 'asc' },
      ...(filters?.skip !== undefined ? { skip: filters.skip } : {}),
      ...(filters?.take !== undefined ? { take: filters.take } : {}),
    })
  })
}

/**
 * Get a single inventory item by ID. Throws NOT_FOUND if missing.
 */
export async function getItem(orgId: string, itemId: string) {
  return runWithOrgContext(orgId, async () => {
    const item = await prisma.inventoryItem.findFirst({
      where: { id: itemId },
    })
    if (!item) {
      const err = new Error('Inventory item not found')
      ;(err as any).code = 'NOT_FOUND'
      throw err
    }
    return item
  })
}

/**
 * Create a new inventory item.
 */
export async function createItem(orgId: string, input: CreateItemInput) {
  const data = CreateItemSchema.parse(input)
  return runWithOrgContext(orgId, async () => {
    return prisma.inventoryItem.create({
      data: {
        name: data.name,
        category: data.category ?? null,
        sku: data.sku ?? null,
        quantityOnHand: data.quantityOnHand,
        reorderThreshold: data.reorderThreshold,
      } as any,
    })
  })
}

/**
 * Update an existing inventory item. Verifies item exists first.
 */
export async function updateItem(
  orgId: string,
  itemId: string,
  input: UpdateItemInput
) {
  const data = UpdateItemSchema.parse(input)
  return runWithOrgContext(orgId, async () => {
    const existing = await prisma.inventoryItem.findFirst({ where: { id: itemId } })
    if (!existing) {
      const err = new Error('Inventory item not found')
      ;(err as any).code = 'NOT_FOUND'
      throw err
    }
    return prisma.inventoryItem.update({
      where: { id: itemId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.category !== undefined && { category: data.category ?? null }),
        ...(data.sku !== undefined && { sku: data.sku ?? null }),
        ...(data.quantityOnHand !== undefined && { quantityOnHand: data.quantityOnHand }),
        ...(data.reorderThreshold !== undefined && { reorderThreshold: data.reorderThreshold }),
      },
    })
  })
}

/**
 * Soft-delete an inventory item. Verifies item exists first.
 */
export async function deleteItem(orgId: string, itemId: string) {
  return runWithOrgContext(orgId, async () => {
    const existing = await prisma.inventoryItem.findFirst({ where: { id: itemId } })
    if (!existing) {
      const err = new Error('Inventory item not found')
      ;(err as any).code = 'NOT_FOUND'
      throw err
    }
    return prisma.inventoryItem.delete({ where: { id: itemId } })
  })
}

// ─── Checkout / Checkin ──────────────────────────────────────────────────────

/**
 * Check out one or more units of an inventory item.
 * Atomically decrements quantity and creates an InventoryTransaction row.
 * Fires low-stock notification if quantity falls below reorder threshold.
 */
export async function checkoutItem(
  orgId: string,
  itemId: string,
  input: CheckoutInput,
  actorUserId: string
) {
  const data = CheckoutSchema.parse(input)
  return runWithOrgContext(orgId, async () => {
    // 1. Fetch item
    const item = await prisma.inventoryItem.findFirst({ where: { id: itemId } })
    if (!item) {
      const err = new Error('Inventory item not found')
      ;(err as any).code = 'NOT_FOUND'
      throw err
    }

    // 2. Check available stock
    if (item.quantityOnHand < data.quantity) {
      const err = new Error(
        `Insufficient stock: ${item.quantityOnHand} unit(s) available, ${data.quantity} requested`
      )
      ;(err as any).code = 'INSUFFICIENT_STOCK'
      throw err
    }

    // 3. Atomically decrement
    const updated = await prisma.inventoryItem.update({
      where: { id: itemId },
      data: { quantityOnHand: { decrement: data.quantity } },
    })

    // 4. Race condition guard — if quantity went negative, roll back and throw
    if (updated.quantityOnHand < 0) {
      await prisma.inventoryItem.update({
        where: { id: itemId },
        data: { quantityOnHand: { increment: data.quantity } },
      })
      const err = new Error('Insufficient stock — concurrent checkout conflict')
      ;(err as any).code = 'INSUFFICIENT_STOCK'
      throw err
    }

    // 5. Create transaction record
    await prisma.inventoryTransaction.create({
      data: {
        itemId,
        type: 'CHECKOUT',
        quantity: -data.quantity, // negative for checkout
        checkedOutById: actorUserId,
        checkedOutAt: new Date(),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        notes: data.notes ?? null,
      } as any,
    })

    // 6. Fire-and-forget low-stock notification
    if (updated.quantityOnHand < updated.reorderThreshold) {
      void notifyLowStock(orgId, item.name, updated.quantityOnHand, itemId)
    }

    return updated
  })
}

/**
 * Check in units from an open checkout transaction.
 * Finds the transaction, increments item quantity, stamps checkedInAt.
 */
export async function checkinItem(
  orgId: string,
  input: CheckinInput,
  actorUserId: string
) {
  const data = CheckinSchema.parse(input)
  return runWithOrgContext(orgId, async () => {
    // 1. Find the transaction
    const transaction = await prisma.inventoryTransaction.findFirst({
      where: {
        id: data.transactionId,
        type: 'CHECKOUT',
      },
    })

    if (!transaction) {
      const err = new Error('Checkout transaction not found')
      ;(err as any).code = 'NOT_FOUND'
      throw err
    }

    // 2. Check it's not already closed
    if (transaction.checkedInAt !== null) {
      const err = new Error('This item has already been checked in')
      ;(err as any).code = 'ALREADY_CHECKED_IN'
      throw err
    }

    // 3. Increment item quantity by the absolute value of the checkout quantity
    const returnQty = Math.abs(transaction.quantity)
    const updatedItem = await prisma.inventoryItem.update({
      where: { id: transaction.itemId },
      data: { quantityOnHand: { increment: returnQty } },
    })

    // 4. Stamp the transaction as checked in
    await prisma.inventoryTransaction.update({
      where: { id: data.transactionId },
      data: {
        checkedInAt: new Date(),
        checkedInById: actorUserId,
        notes: data.notes ?? transaction.notes,
      },
    })

    return updatedItem
  })
}

// ─── AV Equipment CRUD ──────────────────────────────────────────────────────

/**
 * Create a new AV equipment item from the 2-step wizard data.
 * Auto-calculates quantityOnHand from the locations array.
 */
export async function createAVEquipment(
  orgId: string,
  input: CreateAVEquipmentInput
) {
  const data = CreateAVEquipmentSchema.parse(input)
  const totalQuantity = (data.locations || []).reduce((sum, loc) => sum + loc.quantity, 0)

  return runWithOrgContext(orgId, async () => {
    return prisma.inventoryItem.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        category: data.category ?? null,
        ownerId: data.ownerId ?? null,
        allowCheckout: data.allowCheckout,
        locations: data.locations as any,
        quantityOnHand: totalQuantity,
        reorderThreshold: 0,
        manufacturer: data.manufacturer ?? null,
        model: data.model ?? null,
        serialNumbers: data.serialNumbers,
        imageUrl: data.imageUrl ?? null,
        documentationLinks: data.documentationLinks as any,
        tags: data.tags,
      } as any,
    })
  })
}

/**
 * Update an existing AV equipment item.
 * Recalculates quantityOnHand if locations changed.
 */
export async function updateAVEquipment(
  orgId: string,
  itemId: string,
  input: UpdateAVEquipmentInput
) {
  const data = UpdateAVEquipmentSchema.parse(input)

  return runWithOrgContext(orgId, async () => {
    const existing = await prisma.inventoryItem.findFirst({ where: { id: itemId } })
    if (!existing) {
      const err = new Error('Inventory item not found')
      ;(err as any).code = 'NOT_FOUND'
      throw err
    }

    // Recalculate quantityOnHand if locations changed
    let quantityOnHand = existing.quantityOnHand
    if (data.locations) {
      quantityOnHand = (data.locations as any[]).reduce((sum, loc) => sum + loc.quantity, 0)
    }

    return prisma.inventoryItem.update({
      where: { id: itemId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description ?? null }),
        ...(data.ownerId !== undefined && { ownerId: data.ownerId ?? null }),
        ...(data.category !== undefined && { category: data.category ?? null }),
        ...(data.allowCheckout !== undefined && { allowCheckout: data.allowCheckout }),
        ...(data.locations && { locations: data.locations as any, quantityOnHand }),
        ...(data.manufacturer !== undefined && { manufacturer: data.manufacturer ?? null }),
        ...(data.model !== undefined && { model: data.model ?? null }),
        ...(data.serialNumbers && { serialNumbers: data.serialNumbers }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl ?? null }),
        ...(data.tags && { tags: data.tags }),
        ...(data.documentationLinks && { documentationLinks: data.documentationLinks as any }),
      },
    })
  })
}

// ─── Transaction Log ─────────────────────────────────────────────────────────

/**
 * Get transaction history for an inventory item, newest first.
 * Includes actor details for checkout and checkin.
 */
export async function getTransactions(orgId: string, itemId: string) {
  return runWithOrgContext(orgId, async () => {
    return prisma.inventoryTransaction.findMany({
      where: { itemId },
      orderBy: { createdAt: 'desc' },
      include: {
        checkedOutBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        checkedInBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    })
  })
}
