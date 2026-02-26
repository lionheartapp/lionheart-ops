/**
 * Discount Code Service
 * 
 * Manages discount/promo codes and their redemptions.
 * Uses rawPrisma — not org-scoped.
 */

import { rawPrisma } from '@/lib/db'
import { DiscountType } from '@prisma/client'

/**
 * Create a new discount code
 */
export async function createDiscountCode(params: {
  code: string
  type: DiscountType
  value: number
  maxRedemptions?: number
  validFrom?: Date
  validUntil?: Date
  description?: string
  stripeCouponId?: string
}) {
  return rawPrisma.discountCode.create({
    data: {
      code: params.code.toUpperCase().trim(),
      type: params.type,
      value: params.value,
      maxRedemptions: params.maxRedemptions || null,
      validFrom: params.validFrom || new Date(),
      validUntil: params.validUntil || null,
      description: params.description || null,
      stripeCouponId: params.stripeCouponId || null,
      isActive: true,
    },
  })
}

/**
 * Validate a discount code for an organization
 */
export async function validateDiscountCode(code: string, organizationId: string) {
  const discount = await rawPrisma.discountCode.findUnique({
    where: { code: code.toUpperCase().trim() },
  })

  if (!discount) return { valid: false, reason: 'Code not found' }
  if (!discount.isActive) return { valid: false, reason: 'Code is inactive' }
  if (discount.validUntil && discount.validUntil < new Date()) {
    return { valid: false, reason: 'Code has expired' }
  }
  if (discount.maxRedemptions && discount.currentRedemptions >= discount.maxRedemptions) {
    return { valid: false, reason: 'Code has reached maximum redemptions' }
  }

  // Check if org already redeemed
  const existing = await rawPrisma.discountRedemption.findUnique({
    where: {
      discountCodeId_organizationId: {
        discountCodeId: discount.id,
        organizationId,
      },
    },
  })
  if (existing) return { valid: false, reason: 'Code already redeemed by this organization' }

  return { valid: true, discount }
}

/**
 * Redeem a discount code for an organization
 */
export async function redeemDiscountCode(discountCodeId: string, organizationId: string, stripePromotionId?: string) {
  // Create redemption record and increment counter in a transaction
  const [redemption] = await rawPrisma.$transaction([
    rawPrisma.discountRedemption.create({
      data: {
        discountCodeId,
        organizationId,
        stripePromotionId: stripePromotionId || null,
      },
    }),
    rawPrisma.discountCode.update({
      where: { id: discountCodeId },
      data: { currentRedemptions: { increment: 1 } },
    }),
  ])

  return redemption
}

/**
 * List discount codes with filters
 */
export async function listDiscountCodes(params: {
  isActive?: boolean
  page?: number
  perPage?: number
}) {
  const { isActive, page = 1, perPage = 50 } = params

  const where: Record<string, unknown> = {}
  if (isActive !== undefined) where.isActive = isActive

  const [codes, total] = await Promise.all([
    rawPrisma.discountCode.findMany({
      where,
      include: {
        _count: { select: { redemptions: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    rawPrisma.discountCode.count({ where }),
  ])

  return { codes, total, page, perPage }
}

/**
 * Get redemptions for a specific discount code
 */
export async function getDiscountRedemptions(discountCodeId: string) {
  return rawPrisma.discountRedemption.findMany({
    where: { discountCodeId },
    include: {
      organization: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { redeemedAt: 'desc' },
  })
}
