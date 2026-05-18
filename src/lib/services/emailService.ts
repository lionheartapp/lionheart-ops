/**
 * emailService.ts — backwards-compatible barrel re-export
 *
 * All email functions have been decomposed into domain-specific modules
 * under src/lib/services/email/. This file re-exports everything so
 * existing imports (`from '@/lib/services/emailService'`) continue to
 * work without changes.
 *
 * For new code, prefer importing from the specific domain module:
 *   import { sendWelcomeEmail } from '@/lib/services/email/auth-emails'
 */

export {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendMfaEmailCode,
  sendEventUpdateEmails,
  sendEventApprovedEmail,
  sendEventRejectedEmail,
  sendEventCancelledEmail,
  sendEventInviteEmail,
  sendMaintenanceSubmittedEmail,
  sendMaintenanceAssignedEmail,
  sendMaintenanceClaimedEmail,
  sendMaintenanceInProgressEmail,
  sendMaintenanceOnHoldEmail,
  sendMaintenanceQAReadyEmail,
  sendMaintenanceDoneEmail,
  sendMaintenanceUrgentEmail,
  sendMaintenanceStaleEmail,
  sendMaintenanceQARejectedEmail,
  sendRepeatRepairAlertEmail,
  sendCostThresholdAlertEmail,
  sendEndOfLifeAlertEmail,
  sendITTicketSubmittedEmail,
  sendITTicketAssignedEmail,
  sendITTicketInProgressEmail,
  sendITTicketOnHoldEmail,
  sendITTicketDoneEmail,
  sendITTicketUrgentEmail,
  sendBoardReportEmail,
  sendContactFormEmail,
  sendComplianceReminderEmail,
} from './email'
