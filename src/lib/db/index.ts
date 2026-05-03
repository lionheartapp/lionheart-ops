import { PrismaClient } from '@prisma/client'
import { getOrgContextId } from '@/lib/org-context'

// Models that are automatically scoped to the current organization
const orgScopedModels = new Set([
	'User',
	'Ticket',
	'Event',
	'DraftEvent',
	'InventoryItem',
	'InventoryTransaction',
	'TeacherSchedule',
	'District',
	'Site',
	'Building',
	'Space',
	'Room',
	'UserRoomAssignment',
	'Campus',
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
	'Notification',
	// Athletics module
	'Sport',
	'AthleticSeason',
	'AthleticTeam',
	'Game',
	'Practice',
	'Tournament',
	'Athlete',
	'AthleticRoster',
	'PlayerGameStat',
	'SportStatConfig',
	// Maintenance module
	'MaintenanceTicket',
	'MaintenanceTicketWatcher',
	'TechnicianProfile',
	'MaintenanceTicketActivity',
	'MaintenanceLaborEntry',
	'MaintenanceCostEntry',
	'MaintenanceAsset',
	'PmSchedule',
	// Compliance module
	'ComplianceDomainConfig',
	'ComplianceRecord',
	// Knowledge base module
	'KnowledgeArticle',
	// IT Help Desk module
	'ITTicket',
	'ITTicketActivity',
	'ITMagicLink',
	// MDM + Roster module
	'Student',
	'ITDevice',
	'ITDeviceAssignment',
	'ITDeviceRepair',
	'ITLoanerCheckout',
	'ITSyncConfig',
	'ITSyncJob',
	// Device Lifecycle module
	'ITDeploymentBatch',
	'ITDeploymentBatchItem',
	'ITSummerBatch',
	'ITSummerBatchItem',
	'ITVendorRepairLog',
	'ITStudentPasswordToken',
	// Account Provisioning module
	'ITProvisioningEvent',
	'ITProvisioningConfig',
	'ITOrphanedAccount',
	// E-Rate + Content Filter module
	'ITERateTask',
	'ITERateDocument',
	// E-Rate USAC sync module (mirror of opendata.usac.org, keyed by BEN)
	'ITERateEntity',
	'ITERateFundingYear',
	'ITERateForm470',
	'ITERateForm471',
	'ITERateFRN',
	'ITERateDisbursement',
	'ITERateSyncRun',
	'ITContentFilterConfig',
	'ITContentFilterEvent',
	// Security Incident module
	'SecurityIncident',
	'SecurityIncidentActivity',
	// Leo memory module
	'Conversation',
	'ConversationMessage',
	// Event Project module
	'EventProject',
	'EventTeamMember',
	'EventSeries',
	'EventScheduleSection',
	'EventScheduleBlock',
	'ScheduleBlockAttachment',
	'EventTask',
	'EventActivityLog',
	// Phase 22: Event Templates
	'EventTemplate',
	// Registration module (Phase 20)
	'EventRegistration',
	'RegistrationForm',
	// Phase 21: Documents, Groups, Communication, and Day-of Tools
	'EventDocumentRequirement',
	'EventDocumentCompletion',
	'EventComplianceItem',
	'EventGroup',
	'EventGroupAssignment',
	'EventActivityOption',
	'EventActivitySignup',
	'EventAnnouncement',
	'EventCheckIn',
	'EventIncident',
	'EventSurvey',
	'EventSurveyResponse',
	'EventPresenceSession',
	'EventChatMessage',
	// Approval Flow (V2 team-based)
	'ApprovalFlowEntry',
	// Phase 22: Notification Orchestration
	'EventNotificationRule',
	'EventNotificationLog',
	// Phase 22: Budget models (hard delete — no soft delete for clean accounting)
	'BudgetCategory',
	'BudgetLineItem',
	'BudgetRevenue',
	// Phase 22: External Integrations
	'IntegrationCredential',
	'IntegrationSyncLog',
	// Planning Center Services integration
	'PCOServiceLink',
	// Ticket Routing module
	'ModuleRoutingConfig',
	'RoutingCategoryConfig',
	'StaffAvailability',
	'TicketAssignmentLog',
	'CategoryFieldConfig',
	'EscalationRule',
	// Forms module
	'FormDefinition',
	'FormQrCode',
])

// Models that use soft-delete (deletedAt) instead of hard-delete
const softDeleteModels = new Set([
	'User',
	'Ticket',
	'Event',
	'DraftEvent',
	'InventoryItem',
	'District',
	'Site',
	'Building',
	'Space',
	'Room',
	'School',
	'Campus',
	// Calendar module
	'Calendar',
	'CalendarEvent',
	// Maintenance module
	'MaintenanceTicket',
	'MaintenanceAsset',
	// Compliance module
	'ComplianceRecord',
	// Knowledge base module
	'KnowledgeArticle',
	// IT Help Desk module
	'ITTicket',
	// MDM + Roster module
	'Student',
	'ITDevice',
	// Device Lifecycle module
	'ITDeploymentBatch',
	'ITSummerBatch',
	// E-Rate module
	'ITERateTask',
	// Leo memory module
	'Conversation',
	// Event Project module
	'EventProject',
	// Registration module (Phase 20)
	'EventRegistration',
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

// Use a global singleton to prevent hot-reload from creating new connections
const globalForPrisma = globalThis as unknown as { __prisma: PrismaClient | undefined }
export const rawPrisma = globalForPrisma.__prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.__prisma = rawPrisma

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

/**
 * Type-safe delegate accessor for org-scoped Prisma models that are registered
 * in the extension but not exposed in the generated PrismaClient type.
 *
 * Usage:
 *   import { prisma, type OrgPrismaClient } from '@/lib/db'
 *   const db = prisma as unknown as OrgPrismaClient
 *
 * This replaces `const db = prisma as any` with a structured type that preserves
 * method signatures while allowing access to any model delegate.
 */
// eslint-disable-next-line
export type PrismaDelegate = {
	findMany: (args?: Record<string, unknown>) => Promise<any[]>
	findFirst: (args?: Record<string, unknown>) => Promise<any | null>
	findUnique: (args?: Record<string, unknown>) => Promise<any | null>
	create: (args: Record<string, unknown>) => Promise<any>
	createMany: (args: Record<string, unknown>) => Promise<{ count: number }>
	update: (args: Record<string, unknown>) => Promise<any>
	updateMany: (args: Record<string, unknown>) => Promise<{ count: number }>
	upsert: (args: Record<string, unknown>) => Promise<any>
	delete: (args: Record<string, unknown>) => Promise<any>
	deleteMany: (args: Record<string, unknown>) => Promise<{ count: number }>
	count: (args?: Record<string, unknown>) => Promise<number>
	aggregate: (args: Record<string, unknown>) => Promise<any>
}

export type OrgPrismaClient = Record<string, PrismaDelegate>
