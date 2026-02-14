import { PrismaClient } from '@prisma/client'
import { orgStorage } from './orgContext'

const globalForPrisma = globalThis as unknown as { prismaBase: PrismaClient }

const basePrisma = globalForPrisma.prismaBase ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prismaBase = basePrisma

type QueryCtx = { args: Record<string, unknown>; query: (a: Record<string, unknown>) => Promise<unknown> }

function addOrgFilter(args: Record<string, unknown>): void {
  const orgId = orgStorage.getStore()
  if (orgId) {
    const prev = (args.where as object) || {}
    args.where = { ...prev, organizationId: orgId }
  }
}

function addOrgToCreate(args: Record<string, unknown>): void {
  const orgId = orgStorage.getStore()
  if (orgId && args.data && typeof args.data === 'object') {
    args.data = { ...args.data, organizationId: orgId }
  }
}

const tenantOps = {
  findMany: async (ctx: QueryCtx) => { addOrgFilter(ctx.args); return ctx.query(ctx.args) },
  findFirst: async (ctx: QueryCtx) => { addOrgFilter(ctx.args); return ctx.query(ctx.args) },
  findUnique: async (ctx: QueryCtx) => { addOrgFilter(ctx.args); return ctx.query(ctx.args) },
  create: async (ctx: QueryCtx) => { addOrgToCreate(ctx.args); return ctx.query(ctx.args) },
  createMany: async (ctx: QueryCtx) => {
    const orgId = orgStorage.getStore()
    if (orgId && ctx.args.data) {
      const data = Array.isArray(ctx.args.data) ? ctx.args.data : [ctx.args.data]
      ctx.args.data = data.map((d) => (typeof d === 'object' && d ? { ...d, organizationId: orgId } : d))
    }
    return ctx.query(ctx.args)
  },
  update: async (ctx: QueryCtx) => { addOrgFilter(ctx.args); return ctx.query(ctx.args) },
  updateMany: async (ctx: QueryCtx) => { addOrgFilter(ctx.args); return ctx.query(ctx.args) },
  delete: async (ctx: QueryCtx) => { addOrgFilter(ctx.args); return ctx.query(ctx.args) },
  deleteMany: async (ctx: QueryCtx) => { addOrgFilter(ctx.args); return ctx.query(ctx.args) },
}

const tenantModels = [
  'user', 'building', 'ticket', 'event', 'expense', 'budget',
  'maintenanceTip', 'knowledgeBaseEntry', 'inventoryItem', 'pondLog', 'pondConfig',
]

const queryExtension = Object.fromEntries(
  tenantModels.map((m) => [m, tenantOps])
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const prisma = basePrisma.$extends({
  name: 'tenantScope',
  query: queryExtension as any,
}) as unknown as PrismaClient

export const prismaBase = basePrisma
