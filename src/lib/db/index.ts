import { PrismaClient } from '@prisma/client'
import { getOrgContextId } from '@/lib/org-context'

// Models that are automatically scoped to the current organization
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
	'Campus',
	'UserCampusAssignment',
	'School',
	// Calendar module
	'Calendar',
	'CalendarEvent',
	'CalendarCategory',
	'AcademicYear',
	'Term',
	'MarkingPeriod',
	'BellSchedule',
	'DayScheduleAssignment',
	'SpecialDay',
	'PlanningSeason',
	'PlanningSubmission',
	'ApprovalChannelConfig',
	'EventResourceRequest',
])

// Models that use soft-delete (deletedAt) instead of hard-delete
const softDeleteModels = new Set([
	'User',
	'Ticket',
	'Event',
	'DraftEvent',
	'InventoryItem',
	'Building',
	'Area',
	'Room',
	'School',
	'Campus',
	// Calendar module
	'Calendar',
	'CalendarEvent',
])

/**
 * Merge org scoping and soft-delete filtering into a where clause.
 * - orgId: inject { organizationId } if provided
 * - softDelete: inject { deletedAt: null } if true
 */
function mergeWhere(
	where: unknown,
	orgId: string | null,
	softDelete: boolean
) {
	const filters: Record<string, unknown> = {}
	if (orgId) filters.organizationId = orgId
	if (softDelete) filters.deletedAt = null

	if (Object.keys(filters).length === 0) return where
	if (!where || typeof where !== 'object') {
		return { ...filters }
	}
	// Spread filters flat into the where object so that unique identifiers
	// (like `id`) remain at the top level — required for findUnique.
	return { ...(where as Record<string, unknown>), ...filters }
}

export const rawPrisma = new PrismaClient()

const orgScopedPrisma = rawPrisma.$extends({
	query: {
		$allModels: {
			async $allOperations({ model, operation, args, query }) {
				const modelName = model as string
				if (!modelName) return query(args)

				const isOrgScoped = orgScopedModels.has(modelName)
				const isSoftDelete = softDeleteModels.has(modelName)

				if (!isOrgScoped && !isSoftDelete) return query(args)

				const orgId = isOrgScoped ? getOrgContextId() : null
				const nextArgs = { ...(args ?? {}) } as Record<string, unknown>

				// --- CREATE: inject organizationId ---
				if (operation === 'create') {
					if (isOrgScoped) {
						const data = (nextArgs.data ?? {}) as Record<string, unknown>
						nextArgs.data = { ...data, organizationId: orgId }
					}
					return query(nextArgs)
				}

				// --- CREATE MANY: inject organizationId into each row ---
				if (operation === 'createMany') {
					if (isOrgScoped) {
						const data = nextArgs.data
						if (Array.isArray(data)) {
							nextArgs.data = data.map((entry) => ({
								...(entry as Record<string, unknown>),
								organizationId: orgId,
							}))
						} else if (data && typeof data === 'object') {
							nextArgs.data = {
								...(data as Record<string, unknown>),
								organizationId: orgId,
							}
						}
					}
					return query(nextArgs)
				}

				// --- UPSERT: scope where + inject organizationId into create ---
				if (operation === 'upsert') {
					nextArgs.where = mergeWhere(nextArgs.where, orgId, isSoftDelete)
					if (isOrgScoped) {
						const createData = (nextArgs.create ?? {}) as Record<string, unknown>
						nextArgs.create = { ...createData, organizationId: orgId }
					}
					return query(nextArgs)
				}

				// --- DELETE: convert to soft-delete (stamp deletedAt) ---
				if (operation === 'delete' && isSoftDelete) {
					const modelKey = modelName.charAt(0).toLowerCase() + modelName.slice(1)
					return (rawPrisma[modelKey as keyof typeof rawPrisma] as any).update({
						where: mergeWhere(nextArgs.where, orgId, false),
						data: { deletedAt: new Date() },
					})
				}

				// --- DELETE MANY: convert to soft-delete ---
				if (operation === 'deleteMany' && isSoftDelete) {
					const modelKey = modelName.charAt(0).toLowerCase() + modelName.slice(1)
					return (rawPrisma[modelKey as keyof typeof rawPrisma] as any).updateMany({
						where: mergeWhere(nextArgs.where, orgId, false),
						data: { deletedAt: new Date() },
					})
				}

				// --- ALL OTHER READS/WRITES: scope where clause ---
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
					nextArgs.where = mergeWhere(nextArgs.where, orgId, isSoftDelete)
					return query(nextArgs)
				}

				return query(nextArgs)
			},
		},
	},
})

export { orgScopedPrisma as prisma }
