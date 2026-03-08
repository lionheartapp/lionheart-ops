import { z } from 'zod'
import { prisma } from '@/lib/db'

// ============= Validation Schemas =============

export const CheckoutSchema = z.object({
  deviceId: z.string(),
  borrowerStudentId: z.string().optional(),
  borrowerUserId: z.string().optional(),
  dueDate: z.string(), // ISO date
  notes: z.string().optional(),
})

export type CheckoutInput = z.infer<typeof CheckoutSchema>

// ============= Shared Includes =============

const checkoutInclude = {
  device: {
    select: {
      id: true,
      assetTag: true,
      deviceType: true,
      make: true,
      model: true,
      serialNumber: true,
      status: true,
      schoolId: true,
      school: { select: { id: true, name: true } },
      building: { select: { id: true, name: true } },
    },
  },
  borrowerStudent: {
    select: { id: true, firstName: true, lastName: true, grade: true, studentId: true },
  },
  borrowerUser: {
    select: { id: true, name: true, email: true },
  },
  checkedOutBy: {
    select: { id: true, name: true, email: true },
  },
  checkedInBy: {
    select: { id: true, name: true, email: true },
  },
}

// ============= Service Functions =============

/**
 * Get loaner pool statistics and listings.
 * Returns all LOANER devices split into available, checked out, and overdue buckets.
 */
export async function getPool() {
  const now = new Date()

  // All devices marked as LOANER status
  const loanerDevices = await (prisma.iTDevice.findMany as Function)({
    where: { status: 'LOANER' },
    include: {
      school: { select: { id: true, name: true } },
      building: { select: { id: true, name: true } },
      loanerCheckouts: {
        where: { checkedInAt: null },
        take: 1,
        include: {
          borrowerStudent: {
            select: { id: true, firstName: true, lastName: true, grade: true },
          },
          borrowerUser: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    },
    orderBy: { assetTag: 'asc' },
  })

  // All active checkouts (not yet returned)
  const activeCheckouts = await (prisma.iTLoanerCheckout.findMany as Function)({
    where: { checkedInAt: null },
    include: checkoutInclude,
    orderBy: { checkedOutAt: 'desc' },
  })

  // Split into checked out vs overdue
  const checkedOut = activeCheckouts.filter(
    (c: any) => new Date(c.dueDate) >= now
  )
  const overdue = activeCheckouts.filter(
    (c: any) => new Date(c.dueDate) < now
  )

  // Available = loaner devices that have no active checkout
  const checkedOutDeviceIds = new Set(
    activeCheckouts.map((c: any) => c.deviceId)
  )
  const available = loanerDevices.filter(
    (d: any) => !checkedOutDeviceIds.has(d.id)
  )

  return {
    available,
    checkedOut,
    overdue,
    counts: {
      available: available.length,
      checkedOut: checkedOut.length,
      overdue: overdue.length,
      total: loanerDevices.length,
    },
  }
}

/**
 * Check out a loaner device to a student or staff member.
 * Validates device is LOANER status and not currently checked out.
 */
export async function checkout(input: CheckoutInput, checkedOutById: string) {
  const validated = CheckoutSchema.parse(input)

  // Verify device exists and is a loaner
  const device = await (prisma.iTDevice.findUnique as Function)({
    where: { id: validated.deviceId },
  })

  if (!device) {
    throw new Error('Device not found')
  }
  if (device.status !== 'LOANER') {
    throw new Error(`Device ${device.assetTag} is not in the loaner pool (status: ${device.status})`)
  }

  // Check for active checkout on this device
  const existingCheckout = await (prisma.iTLoanerCheckout.findFirst as Function)({
    where: {
      deviceId: validated.deviceId,
      checkedInAt: null,
    },
  })

  if (existingCheckout) {
    throw new Error(`Device ${device.assetTag} is already checked out`)
  }

  // Create the checkout record
  const record = await (prisma.iTLoanerCheckout.create as Function)({
    data: {
      deviceId: validated.deviceId,
      borrowerStudentId: validated.borrowerStudentId || null,
      borrowerUserId: validated.borrowerUserId || null,
      dueDate: new Date(validated.dueDate),
      notes: validated.notes || null,
      checkedOutById,
    },
    include: checkoutInclude,
  })

  return record
}

/**
 * Check in a loaner device (mark as returned).
 * Stamps checkedInAt and records who checked it in.
 */
export async function checkin(checkoutId: string, checkedInById: string) {
  const existing = await (prisma.iTLoanerCheckout.findUnique as Function)({
    where: { id: checkoutId },
  })

  if (!existing) {
    throw new Error('Checkout record not found')
  }
  if (existing.checkedInAt) {
    throw new Error('This device has already been checked in')
  }

  const updated = await (prisma.iTLoanerCheckout.update as Function)({
    where: { id: checkoutId },
    data: {
      checkedInAt: new Date(),
      checkedInById,
    },
    include: checkoutInclude,
  })

  return updated
}

/**
 * Get all overdue loaner checkouts (past due date and not yet returned).
 */
export async function getOverdue() {
  const now = new Date()

  const overdueCheckouts = await (prisma.iTLoanerCheckout.findMany as Function)({
    where: {
      dueDate: { lt: now },
      checkedInAt: null,
    },
    include: checkoutInclude,
    orderBy: { dueDate: 'asc' },
  })

  return overdueCheckouts
}

/**
 * Get checkout history, optionally filtered by device.
 * Ordered by most recent checkout first.
 */
export async function getCheckoutHistory(deviceId?: string) {
  const where: any = {}
  if (deviceId) {
    where.deviceId = deviceId
  }

  const history = await (prisma.iTLoanerCheckout.findMany as Function)({
    where,
    include: checkoutInclude,
    orderBy: { checkedOutAt: 'desc' },
  })

  return history
}
