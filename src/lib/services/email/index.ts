/**
 * Email Service — barrel re-export
 *
 * Domain-specific email functions are organized into separate modules:
 *   - auth-emails.ts     — verification, password reset, welcome
 *   - event-emails.ts    — event notifications (update, approved, rejected, etc.)
 *   - maintenance-emails.ts — ticket lifecycle + asset intelligence alerts
 *   - it-emails.ts       — IT help desk ticket notifications
 *   - report-emails.ts   — board reports, compliance reminders, contact form
 *   - transport.ts       — shared SMTP/Resend send infrastructure
 */

export { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail, sendMfaEmailCode } from './auth-emails'
export { sendEventUpdateEmails, sendEventApprovedEmail, sendEventRejectedEmail, sendEventCancelledEmail, sendEventInviteEmail } from './event-emails'
export { sendMaintenanceSubmittedEmail, sendMaintenanceAssignedEmail, sendMaintenanceClaimedEmail, sendMaintenanceInProgressEmail, sendMaintenanceOnHoldEmail, sendMaintenanceQAReadyEmail, sendMaintenanceDoneEmail, sendMaintenanceUrgentEmail, sendMaintenanceStaleEmail, sendMaintenanceQARejectedEmail, sendRepeatRepairAlertEmail, sendCostThresholdAlertEmail, sendEndOfLifeAlertEmail } from './maintenance-emails'
export { sendITTicketSubmittedEmail, sendITTicketAssignedEmail, sendITTicketInProgressEmail, sendITTicketOnHoldEmail, sendITTicketDoneEmail, sendITTicketUrgentEmail } from './it-emails'
export { sendBoardReportEmail, sendContactFormEmail, sendComplianceReminderEmail } from './report-emails'
export { sendMessagingDigest } from './messaging-emails'
