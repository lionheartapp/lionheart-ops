/**
 * Phase 21 Shared TypeScript Types
 *
 * Interfaces for Documents, Groups, Communication, and Day-of Tools.
 * Consumed by API routes (response shaping) and UI components (prop types).
 */

// ─── Enums (mirrors Prisma) ───────────────────────────────────────────────────

export type EventGroupType = 'BUS' | 'CABIN' | 'SMALL_GROUP' | 'ACTIVITY'
export type ComplianceItemStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE'
export type EventIncidentSeverity = 'MINOR' | 'MODERATE' | 'SERIOUS'
export type EventIncidentType = 'MEDICAL' | 'BEHAVIORAL' | 'SAFETY' | 'OTHER'
export type AnnouncementAudience = 'ALL' | 'GROUP' | 'INCOMPLETE_DOCS' | 'PAID_ONLY'
export type SurveyStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED'

// ─── Document Requirements ────────────────────────────────────────────────────

/**
 * A single document requirement enriched with completion counts across all
 * registered participants for the event.
 */
export interface EventDocumentRequirementWithStatus {
  id: string
  eventProjectId: string
  label: string
  description: string | null
  documentType: string
  isRequired: boolean
  dueDate: string | null  // ISO datetime string
  sortOrder: number
  completedCount: number  // participants who have completed this requirement
  totalCount: number      // total registered participants
  createdAt: string
  updatedAt: string
}

/**
 * Per-participant document completion status for a single requirement.
 */
export interface DocumentCompletionStatus {
  requirementId: string
  requirementLabel: string
  isComplete: boolean
  completedAt: string | null
  fileUrl: string | null
  notes: string | null
}

/**
 * Full document status for a single participant across all requirements.
 */
export interface ParticipantDocumentStatus {
  registrationId: string
  participantName: string  // firstName + ' ' + lastName
  email: string
  requirements: DocumentCompletionStatus[]
  completedCount: number
  totalCount: number
  isFullyComplete: boolean
}

// ─── Groups ───────────────────────────────────────────────────────────────────

/**
 * A group enriched with assignment count and leader display name.
 */
export interface EventGroupWithAssignments {
  id: string
  eventProjectId: string
  name: string
  type: EventGroupType
  capacity: number | null
  leaderId: string | null
  leaderName: string | null   // leader's full name, null if no leader
  description: string | null
  sortOrder: number
  assignmentCount: number     // current number of participants assigned
  createdAt: string
  updatedAt: string
}

/**
 * A group assignment with participant info.
 */
export interface EventGroupAssignmentWithParticipant {
  id: string
  registrationId: string
  groupId: string
  participantName: string
  participantEmail: string
  assignedAt: string
  assignedByName: string | null
}

// ─── Announcements ────────────────────────────────────────────────────────────

/**
 * An announcement enriched with author display info.
 */
export interface EventAnnouncementWithAuthor {
  id: string
  eventProjectId: string
  title: string
  body: string
  audience: AnnouncementAudience
  targetGroupId: string | null
  targetGroupName: string | null  // name of targeted group, null for ALL
  sentAt: string | null
  createdById: string
  authorName: string       // full name of the author user
  authorAvatar: string | null
  createdAt: string
  updatedAt: string
}

// ─── Check-In ─────────────────────────────────────────────────────────────────

/**
 * Aggregate check-in summary for an event project.
 */
export interface EventCheckInSummary {
  eventProjectId: string
  checkedInCount: number   // number of participants who have checked in
  totalCount: number       // total registered participants
  percentCheckedIn: number // 0-100 rounded to nearest integer
  lastCheckInAt: string | null
}

/**
 * A single check-in record with participant info.
 */
export interface EventCheckInRecord {
  id: string
  registrationId: string
  participantName: string
  participantEmail: string
  checkedInAt: string
  checkedInByName: string | null
  method: 'QR_SCAN' | 'MANUAL'
  syncedAt: string | null
}

// ─── Incidents ────────────────────────────────────────────────────────────────

/**
 * An incident enriched with participant names.
 */
export interface EventIncidentWithParticipants {
  id: string
  eventProjectId: string
  type: EventIncidentType
  severity: EventIncidentSeverity
  description: string
  actionsTaken: string | null
  followUpNeeded: boolean
  followUpNotes: string | null
  photoUrl: string | null
  reportedById: string
  reporterName: string          // full name of the reporting user
  syncedAt: string | null
  participants: Array<{
    registrationId: string
    participantName: string
  }>
  createdAt: string
  updatedAt: string
}

// ─── Compliance ───────────────────────────────────────────────────────────────

/**
 * A compliance checklist item with assignee info.
 */
export interface EventComplianceItemWithAssignee {
  id: string
  eventProjectId: string
  label: string
  description: string | null
  status: ComplianceItemStatus
  assigneeId: string | null
  assigneeName: string | null   // full name of assignee user
  dueDate: string | null
  fileUrl: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

// ─── Surveys ──────────────────────────────────────────────────────────────────

/**
 * A survey with response count.
 */
export interface EventSurveyWithStats {
  id: string
  eventProjectId: string
  formId: string
  formTitle: string | null
  status: SurveyStatus
  opensAt: string | null
  closesAt: string | null
  responseCount: number
  createdAt: string
  updatedAt: string
}

// ─── Presence ─────────────────────────────────────────────────────────────────

/**
 * A real-time presence session with user info.
 */
export interface EventPresenceSessionWithUser {
  id: string
  eventProjectId: string
  userId: string
  userName: string
  userAvatar: string | null
  activeTab: string | null
  lastSeenAt: string
}
