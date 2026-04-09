#!/usr/bin/env node
/**
 * One-time Stripe product + price setup for Lionheart subscription plans.
 *
 * Usage:
 *   node scripts/setup-stripe-products.mjs           # real run
 *   node scripts/setup-stripe-products.mjs --dry-run # log what would happen, no Stripe/DB calls
 *
 * Idempotent: looks up existing Stripe products by metadata.lionheart_slug
 * before creating. Safe to re-run.
 *
 * After creating products + prices, upserts rows in the SubscriptionPlan
 * table with the resulting stripePriceId. Uses a fresh PrismaClient
 * (bypasses the org-scoped extension in src/lib/db/index.ts — scripts
 * legitimately need the raw client).
 */

import { PrismaClient } from '@prisma/client'
import Stripe from 'stripe'

// ---------------------------------------------------------------------------
// Plan definitions
// ---------------------------------------------------------------------------

const PLANS = [
  {
    slug: 'essentials',
    name: 'Essentials',
    description:
      'Core operations for a single campus — calendaring, event planning, maintenance, IT, and A/V.',
    annualCents: 780000, // $7,800/year
    displayOrder: 1,
    trialDays: 14,
    features: {
      campuses: 1,
      aiActionsPerMonth: 50,
      calendaring: true,
      eventPlanning: true,
      maintenanceTickets: true,
      itTickets: true,
      avRequests: true,
      roomManagement: true,
      systemRoles: true,
      standardReporting: true,
      emailSupport: true,
    },
  },
  {
    slug: 'pro',
    name: 'Pro',
    description:
      'Unlimited AI, full suites, calendar integrations, and custom roles — most popular for growing schools.',
    annualCents: 1280000, // $12,800/year
    displayOrder: 2,
    trialDays: 14,
    features: {
      campuses: 1,
      aiActionsPerMonth: 'unlimited',
      everythingInEssentials: true,
      fullMaintenanceSuite: true,
      fullITSuite: true,
      fullAVSuite: true,
      googleCalendarSync: true,
      outlookCalendarSync: true,
      customRolesAndPermissions: true,
      advancedReporting: true,
      prioritySupport: true,
      mostPopular: true,
    },
  },
  {
    slug: 'enterprise',
    name: 'Enterprise',
    description:
      'Multi-campus, SSO/SAML, audit logs, API access, and a dedicated CSM with 99.9% uptime SLA.',
    annualCents: 1680000, // $16,800/year base (includes 2 campuses)
    displayOrder: 3,
    trialDays: 14,
    features: {
      campuses: 2,
      additionalCampusPrice: 400000,
      everythingInPro: true,
      ssoSaml: true,
      auditLogs: true,
      apiAccess: true,
      customPermissionScopes: true,
      whiteLabel: true,
      dedicatedCSM: true,
      uptimeSLA: '99.9%',
      quarterlyBusinessReviews: true,
      phoneSupport: true,
      _note:
        'Multi-campus pricing beyond 2 campuses is TODO — handle manually for now',
    },
  },
]

// ---------------------------------------------------------------------------
// Args + env
// ---------------------------------------------------------------------------

const DRY_RUN = process.argv.includes('--dry-run')

function logStep(msg) {
  const prefix = DRY_RUN ? '[dry-run]' : '[stripe-setup]'
  console.log(`${prefix} ${msg}`)
}

function logErr(msg) {
  console.error(`[stripe-setup][error] ${msg}`)
}

function requireEnv(name) {
  const value = process.env[name]
  if (!value || value.trim() === '') {
    logErr(`Missing required env var: ${name}`)
    logErr(
      name === 'STRIPE_SECRET_KEY'
        ? 'Add STRIPE_SECRET_KEY to .env (production) or .env.local (dev) before running this script.'
        : 'This script cannot run without this value.'
    )
    process.exit(1)
  }
  return value
}

// ---------------------------------------------------------------------------
// Stripe helpers
// ---------------------------------------------------------------------------

/**
 * Find an existing Stripe product by lionheart_slug metadata.
 * Returns null if not found.
 */
async function findExistingProduct(stripe, slug) {
  // Stripe's search API is the cleanest way to match on metadata.
  // Falls back to listing if search is unavailable on the account.
  try {
    const result = await stripe.products.search({
      query: `metadata['lionheart_slug']:'${slug}' AND active:'true'`,
      limit: 1,
    })
    return result.data[0] || null
  } catch (searchErr) {
    logStep(
      `Stripe search unavailable (${searchErr.message}); falling back to list scan.`
    )
    let startingAfter
    // Paginate up to a reasonable cap (10 pages × 100 = 1000 products).
    for (let page = 0; page < 10; page += 1) {
      const batch = await stripe.products.list({
        limit: 100,
        active: true,
        starting_after: startingAfter,
      })
      const match = batch.data.find((p) => p.metadata?.lionheart_slug === slug)
      if (match) return match
      if (!batch.has_more) break
      startingAfter = batch.data[batch.data.length - 1]?.id
    }
    return null
  }
}

/**
 * Find an existing annual recurring price for a product.
 * Matches on amount + currency + interval.
 */
async function findExistingAnnualPrice(stripe, productId, annualCents) {
  const prices = await stripe.prices.list({
    product: productId,
    active: true,
    limit: 100,
  })
  return (
    prices.data.find(
      (p) =>
        p.unit_amount === annualCents &&
        p.currency === 'usd' &&
        p.recurring?.interval === 'year'
    ) || null
  )
}

/**
 * Create or reuse the Stripe product + annual price for a single plan.
 * Returns { productId, priceId }.
 */
async function ensureStripeProduct(stripe, plan) {
  logStep(`Ensuring Stripe product for "${plan.name}" (${plan.slug})...`)

  if (DRY_RUN) {
    logStep(
      `  would search for product metadata.lionheart_slug='${plan.slug}'`
    )
    logStep(
      `  would create product { name: "${plan.name}", metadata.lionheart_slug: "${plan.slug}" } if missing`
    )
    logStep(
      `  would create annual price { unit_amount: ${plan.annualCents}, currency: 'usd', interval: 'year' } if missing`
    )
    return { productId: `dryrun_prod_${plan.slug}`, priceId: `dryrun_price_${plan.slug}` }
  }

  // 1. Find or create the product
  let product = await findExistingProduct(stripe, plan.slug)
  if (product) {
    logStep(`  reusing existing product ${product.id}`)
  } else {
    product = await stripe.products.create({
      name: plan.name,
      description: plan.description,
      metadata: {
        lionheart_slug: plan.slug,
        lionheart_plan: 'true',
      },
    })
    logStep(`  created product ${product.id}`)
  }

  // 2. Find or create the annual price
  let price = await findExistingAnnualPrice(stripe, product.id, plan.annualCents)
  if (price) {
    logStep(
      `  reusing existing annual price ${price.id} ($${(plan.annualCents / 100).toFixed(2)}/year)`
    )
  } else {
    price = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.annualCents,
      currency: 'usd',
      recurring: { interval: 'year' },
      metadata: {
        lionheart_slug: plan.slug,
        billing_cadence: 'annual',
      },
    })
    logStep(
      `  created annual price ${price.id} ($${(plan.annualCents / 100).toFixed(2)}/year)`
    )
  }

  return { productId: product.id, priceId: price.id }
}

// ---------------------------------------------------------------------------
// Prisma helpers
// ---------------------------------------------------------------------------

/**
 * Upsert a SubscriptionPlan row. Uses the raw PrismaClient — scripts
 * intentionally bypass the org-scoped extension.
 */
async function upsertPlan(prisma, plan, stripePriceId) {
  const monthlyDisplayCents = Math.round(plan.annualCents / 12)

  if (DRY_RUN) {
    logStep(
      `  would upsert SubscriptionPlan { slug: "${plan.slug}", stripePriceId: "${stripePriceId}", monthlyPrice: ${monthlyDisplayCents}, annualPrice: ${plan.annualCents}, trialDays: ${plan.trialDays}, displayOrder: ${plan.displayOrder} }`
    )
    return { id: `dryrun_plan_${plan.slug}` }
  }

  const row = await prisma.subscriptionPlan.upsert({
    where: { slug: plan.slug },
    create: {
      name: plan.name,
      slug: plan.slug,
      stripePriceId,
      monthlyPrice: monthlyDisplayCents,
      annualPrice: plan.annualCents,
      features: plan.features,
      trialDays: plan.trialDays,
      isActive: true,
      displayOrder: plan.displayOrder,
    },
    update: {
      name: plan.name,
      stripePriceId,
      monthlyPrice: monthlyDisplayCents,
      annualPrice: plan.annualCents,
      features: plan.features,
      trialDays: plan.trialDays,
      isActive: true,
      displayOrder: plan.displayOrder,
    },
  })
  logStep(`  upserted SubscriptionPlan row id=${row.id}`)
  return row
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  logStep(
    DRY_RUN
      ? 'Starting dry run — no Stripe or DB calls will be made.'
      : 'Starting Stripe product + plan setup.'
  )

  // Env check
  let stripe = null
  if (!DRY_RUN) {
    const secret = requireEnv('STRIPE_SECRET_KEY')
    stripe = new Stripe(secret, { apiVersion: '2024-06-20' })
  } else {
    if (!process.env.STRIPE_SECRET_KEY) {
      logStep('STRIPE_SECRET_KEY not set — dry run will still show planned steps.')
    }
  }

  // Prisma client
  let prisma = null
  if (!DRY_RUN) {
    try {
      prisma = new PrismaClient()
      // Quick connectivity probe so we fail fast before hitting Stripe
      await prisma.$queryRaw`SELECT 1`
    } catch (dbErr) {
      logErr(`Database connection failed: ${dbErr.message}`)
      logErr(
        'Verify DATABASE_URL / DIRECT_URL are set and the database is reachable.'
      )
      process.exit(1)
    }
  }

  const results = []

  try {
    for (const plan of PLANS) {
      const { productId, priceId } = await ensureStripeProduct(stripe, plan)
      const row = await upsertPlan(prisma, plan, priceId)
      results.push({
        slug: plan.slug,
        name: plan.name,
        productId,
        priceId,
        planRowId: row.id,
        annualCents: plan.annualCents,
      })
    }
  } catch (err) {
    logErr(`Setup failed: ${err.message}`)
    if (err.stack) console.error(err.stack)
    if (prisma) await prisma.$disconnect()
    process.exit(1)
  }

  // Summary
  console.log('')
  console.log('─────────────────────────────────────────────')
  console.log(DRY_RUN ? 'Dry run summary:' : 'Stripe products created:')
  console.log('─────────────────────────────────────────────')
  for (const r of results) {
    console.log(
      `  • ${r.name.padEnd(12)} slug=${r.slug.padEnd(12)} product=${r.productId}  price=${r.priceId}  $${(r.annualCents / 100).toFixed(2)}/yr`
    )
  }
  console.log('─────────────────────────────────────────────')
  console.log('')

  if (prisma) await prisma.$disconnect()

  if (DRY_RUN) {
    logStep('Dry run complete. Re-run without --dry-run to apply changes.')
  } else {
    console.log('Stripe products created. Plan IDs saved to DB.')
  }
}

main().catch((err) => {
  logErr(`Unhandled error: ${err.message}`)
  if (err.stack) console.error(err.stack)
  process.exit(1)
})
