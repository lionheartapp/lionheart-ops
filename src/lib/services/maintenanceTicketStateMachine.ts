/**
 * Maintenance Ticket State Machine
 *
 * Defines the 8-status lifecycle, valid transitions, required permissions,
 * and required fields for each state change.
 *
 * Extracted from maintenanceTicketService.ts for clarity and reuse.
 */

import { PERMISSIONS } from '@/lib/permissions'
import type {
  MaintenanceTicketStatus,
  MaintenanceCategory,
  MaintenanceSpecialty,
} from '@prisma/client'

// ─── Category → Specialty Map ─────────────────────────────────────────────────

export const CATEGORY_TO_SPECIALTY: Record<MaintenanceCategory, MaintenanceSpecialty> = {
  ELECTRICAL: 'ELECTRICAL',
  PLUMBING: 'PLUMBING',
  HVAC: 'HVAC',
  STRUCTURAL: 'STRUCTURAL',
  CUSTODIAL_BIOHAZARD: 'CUSTODIAL_BIOHAZARD',
  IT_AV: 'IT_AV',
  GROUNDS: 'GROUNDS',
  OTHER: 'OTHER',
}

// ─── Transition Config ───────────────────────────────────────────────────────

export type TransitionConfig = {
  requiredPermissions: string[]
  requiredFields?: string[]
  description: string
}

export const ALLOWED_TRANSITIONS: Record<
  MaintenanceTicketStatus,
  Partial<Record<MaintenanceTicketStatus, TransitionConfig>>
> = {
  BACKLOG: {
    TODO: {
      requiredPermissions: [PERMISSIONS.MAINTENANCE_CLAIM, PERMISSIONS.MAINTENANCE_ASSIGN],
      description: 'Claim or assign ticket to start work',
    },
    SCHEDULED: {
      requiredPermissions: [PERMISSIONS.MAINTENANCE_ASSIGN],
      description: 'Schedule ticket for a future date',
    },
    CANCELLED: {
      requiredPermissions: [PERMISSIONS.MAINTENANCE_CANCEL],
      requiredFields: ['cancellationReason'],
      description: 'Cancel ticket with reason',
    },
  },
  TODO: {
    IN_PROGRESS: {
      requiredPermissions: [PERMISSIONS.MAINTENANCE_CLAIM, PERMISSIONS.MAINTENANCE_ASSIGN],
      description: 'Begin working on ticket',
    },
    BACKLOG: {
      requiredPermissions: [PERMISSIONS.MAINTENANCE_CLAIM, PERMISSIONS.MAINTENANCE_ASSIGN],
      description: 'Send ticket back to backlog',
    },
    ON_HOLD: {
      requiredPermissions: [PERMISSIONS.MAINTENANCE_CLAIM, PERMISSIONS.MAINTENANCE_ASSIGN],
      requiredFields: ['holdReason'],
      description: 'Place ticket on hold with reason',
    },
    CANCELLED: {
      requiredPermissions: [PERMISSIONS.MAINTENANCE_CANCEL],
      requiredFields: ['cancellationReason'],
      description: 'Cancel ticket with reason',
    },
  },
  IN_PROGRESS: {
    QA: {
      requiredPermissions: [PERMISSIONS.MAINTENANCE_CLAIM, PERMISSIONS.MAINTENANCE_ASSIGN],
      requiredFields: ['completionNote', 'completionPhotos'],
      description: 'Submit for QA review with completion evidence',
    },
    TODO: {
      requiredPermissions: [PERMISSIONS.MAINTENANCE_CLAIM, PERMISSIONS.MAINTENANCE_ASSIGN],
      description: 'Send ticket back to todo',
    },
    ON_HOLD: {
      requiredPermissions: [PERMISSIONS.MAINTENANCE_CLAIM, PERMISSIONS.MAINTENANCE_ASSIGN],
      requiredFields: ['holdReason'],
      description: 'Place ticket on hold with reason',
    },
    CANCELLED: {
      requiredPermissions: [PERMISSIONS.MAINTENANCE_CANCEL],
      requiredFields: ['cancellationReason'],
      description: 'Cancel ticket with reason',
    },
  },
  ON_HOLD: {
    TODO: {
      requiredPermissions: [PERMISSIONS.MAINTENANCE_CLAIM, PERMISSIONS.MAINTENANCE_ASSIGN],
      description: 'Return ticket to todo',
    },
    IN_PROGRESS: {
      requiredPermissions: [PERMISSIONS.MAINTENANCE_CLAIM, PERMISSIONS.MAINTENANCE_ASSIGN],
      description: 'Resume work on ticket',
    },
    CANCELLED: {
      requiredPermissions: [PERMISSIONS.MAINTENANCE_CANCEL],
      requiredFields: ['cancellationReason'],
      description: 'Cancel ticket with reason',
    },
  },
  QA: {
    DONE: {
      requiredPermissions: [PERMISSIONS.MAINTENANCE_APPROVE_QA],
      description: 'Approve QA and close ticket',
    },
    IN_PROGRESS: {
      requiredPermissions: [PERMISSIONS.MAINTENANCE_APPROVE_QA],
      requiredFields: ['rejectionNote'],
      description: 'Reject QA and send back to work',
    },
    CANCELLED: {
      requiredPermissions: [PERMISSIONS.MAINTENANCE_CANCEL],
      requiredFields: ['cancellationReason'],
      description: 'Cancel ticket with reason',
    },
  },
  SCHEDULED: {
    BACKLOG: {
      requiredPermissions: [PERMISSIONS.MAINTENANCE_ASSIGN],
      description: 'Release scheduled ticket to backlog (system/cron)',
    },
    CANCELLED: {
      requiredPermissions: [PERMISSIONS.MAINTENANCE_CANCEL],
      requiredFields: ['cancellationReason'],
      description: 'Cancel ticket with reason',
    },
  },
  PENDING_APPROVAL: {
    BACKLOG: {
      requiredPermissions: [PERMISSIONS.MAINTENANCE_APPROVE_QA],
      description: 'Approve ticket and move to backlog',
    },
    CANCELLED: {
      requiredPermissions: [PERMISSIONS.MAINTENANCE_APPROVE_QA],
      requiredFields: ['cancellationReason'],
      description: 'Reject ticket with reason',
    },
  },
  DONE: {},
  CANCELLED: {},
}
