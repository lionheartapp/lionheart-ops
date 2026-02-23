import { PrismaClient } from '@prisma/client'
import { getOrgContextId } from '@/lib/org-context'

const orgScopedModels = new Set([
	'User',
	'Ticket',
	'Event',
	'DraftEvent',
	'InventoryItem',
	'TeacherSchedule',
	'Building',
	'Area',
	'Room',
	'UserRoomAssignment',
])

function mergeOrgWhere(where: unknown, organizationId: string) {
	if (!where || typeof where !== 'object') {
		return { organizationId }
	}
	return { AND: [where, { organizationId }] }
}

const rawPrisma = new PrismaClient()

const orgScopedPrisma = rawPrisma.$extends({
	query: {
		$allModels: {
			async $allOperations({ model, operation, args, query }) {
				if (!model || !orgScopedModels.has(model)) {
					return query(args)
				}

				const orgId = getOrgContextId()
				const nextArgs = { ...(args ?? {}) } as Record<string, unknown>

				if (operation === 'create') {
					const data = (nextArgs.data ?? {}) as Record<string, unknown>
					nextArgs.data = { ...data, organizationId: orgId }
					return query(nextArgs)
				}

				if (operation === 'createMany') {
					const data = nextArgs.data
					if (Array.isArray(data)) {
						nextArgs.data = data.map((entry) => ({ ...(entry as Record<string, unknown>), organizationId: orgId }))
					} else if (data && typeof data === 'object') {
						nextArgs.data = { ...(data as Record<string, unknown>), organizationId: orgId }
					}
					return query(nextArgs)
				}

				if (operation === 'upsert') {
					const where = mergeOrgWhere(nextArgs.where, orgId)
					const createData = (nextArgs.create ?? {}) as Record<string, unknown>
					nextArgs.where = where
					nextArgs.create = { ...createData, organizationId: orgId }
					return query(nextArgs)
				}

				if (
					operation === 'findMany' ||
					operation === 'findFirst' ||
					operation === 'findUnique' ||
					operation === 'update' ||
					operation === 'updateMany' ||
					operation === 'delete' ||
					operation === 'deleteMany' ||
					operation === 'count' ||
					operation === 'aggregate' ||
					operation === 'groupBy'
				) {
					nextArgs.where = mergeOrgWhere(nextArgs.where, orgId)
					return query(nextArgs)
				}

				return query(nextArgs)
			},
		},
	},
})

export { rawPrisma, orgScopedPrisma as prisma }
