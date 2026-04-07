/**
 * Lionheart-branded MJML email templates.
 *
 * Layout, brand tokens, and MJML helpers are in email-layout.ts.
 * This file defines per-template MJML content, subjects, and text bodies.
 */

import mjml2html from 'mjml'
import { logger } from '@/lib/logger'
import {
  B,
  wrapLayout,
  heroHeading,
  centeredCta,
  contentSection,
  detailCard,
} from './email-layout'

// ─── Template Definitions ────────────────────────────────────────────────────

export type EmailTemplate =
  | 'welcome'
  | 'email_verification'
  | 'event_updated'
  | 'event_approved'
  | 'event_rejected'
  | 'event_cancelled'
  | 'event_invite'
  | 'password_setup'
  | 'password_reset'
  // Maintenance email templates (10 triggers)
  | 'maintenance_submitted'
  | 'maintenance_assigned'
  | 'maintenance_claimed'
  | 'maintenance_in_progress'
  | 'maintenance_on_hold'
  | 'maintenance_qa_ready'
  | 'maintenance_done'
  | 'maintenance_urgent'
  | 'maintenance_stale'
  | 'maintenance_qa_rejected'
  // Maintenance asset intelligence alerts (3 triggers)
  | 'maintenance_repeat_repair'
  | 'maintenance_cost_threshold'
  | 'maintenance_end_of_life'
  // IT Help Desk email templates (6 triggers)
  | 'it_ticket_submitted'
  | 'it_ticket_assigned'
  | 'it_ticket_in_progress'
  | 'it_ticket_on_hold'
  | 'it_ticket_done'
  | 'it_ticket_urgent'

type TemplateVars = Record<string, string | undefined>

function getTemplateMjml(template: EmailTemplate, vars: TemplateVars): string {
  switch (template) {
    // ── Welcome (new account created by admin) ──
    case 'welcome':
      return wrapLayout({
        previewText: 'Your account is ready — set your password to get started',
        content: [
          heroHeading('- Your Account Is Ready -', "It's Your Time<br />to Get Started"),
        ].join('\n'),
        blueBand: {
          text: `Your account at <strong>{{orgName}}</strong> is ready. Explore your calendar, manage events, track inventory, and more — all in one place. What will you accomplish with Lionheart?`,
          ctaLabel: 'Set Your Password',
          ctaUrl: '{{setupLink}}',
        },
      })

    // ── Password setup (invited user) ──
    case 'password_setup':
      return wrapLayout({
        previewText: 'Set your password to join {{orgName}} on Lionheart',
        content: [
          heroHeading("- You're Invited -", 'Complete Your<br />Account Setup'),
        ].join('\n'),
        blueBand: {
          text: `You've been invited to join <strong>{{orgName}}</strong> on Lionheart. Set your password to access calendars, events, facilities, and everything your team uses to stay organized.`,
          ctaLabel: 'Get Started',
          ctaUrl: '{{setupLink}}',
        },
      })

    // ── Password reset ──
    case 'password_reset':
      return wrapLayout({
        previewText: 'Reset your password for {{orgName}} on Lionheart',
        content: [
          heroHeading('- Password Reset -', 'Reset Your<br />Password'),
          contentSection(
            `<mj-text align="center" padding="0" font-size="16px">
              Hi {{firstName}}, we received a request to reset your password for <strong>{{orgName}}</strong>. Click the button below to set a new password. This link expires in 1 hour.
            </mj-text>`,
            '8px 40px 0 40px'
          ),
          centeredCta('Reset Password', '{{resetLink}}'),
        ].join('\n'),
        blueBand: {
          text: `If you didn't request this, you can safely ignore this email. Your password will not change.`,
        },
      })

    // ── Email Verification ──
    case 'email_verification':
      return wrapLayout({
        previewText: 'Verify your email address to get started with {{orgName}}',
        content: [
          heroHeading('- Welcome to Lionheart -', 'Verify Your<br />Email Address'),
          contentSection(
            `<mj-text align="center" padding="0" font-size="16px">
              Hi {{firstName}}, welcome to <strong>{{orgName}}</strong>! Please verify your email address to activate your account and get started.
            </mj-text>`,
            '8px 40px 0 40px'
          ),
          centeredCta('Verify Email', '{{verificationLink}}'),
        ].join('\n'),
        blueBand: {
          text: 'This verification link expires in 24 hours. If you did not create an account on Lionheart, you can safely ignore this email.',
        },
      })

    // ── Event rescheduled ──
    case 'event_updated':
      return wrapLayout({
        previewText: '{{eventTitle}} has been rescheduled',
        content: [
          heroHeading('- Event Update -', 'Event<br />Rescheduled'),
          contentSection(
            `<mj-text align="center" padding="0" font-size="16px">
              <strong>{{eventTitle}}</strong> has been rescheduled by {{updatedByName}}.
            </mj-text>`,
            '8px 40px 0 40px'
          ),
          detailCard(
            `<strong>New Time</strong><br />{{eventDate}}<br />{{eventTime}}`
          ),
          centeredCta('View Event', '{{eventLink}}'),
          contentSection(
            `<mj-text align="center" font-size="12px" color="${B.gray400}">You're receiving this because you're an attendee of this event.</mj-text>`,
            '8px 40px 24px 40px'
          ),
        ].join('\n'),
      })

    // ── Event approved ──
    case 'event_approved':
      return wrapLayout({
        previewText: 'Your event "{{eventTitle}}" has been approved',
        content: [
          heroHeading('- Good News -', 'Event<br />Approved'),
          contentSection(
            `<mj-text align="center" padding="0" font-size="16px">
              Your event <strong>{{eventTitle}}</strong> has been approved.
            </mj-text>`,
            '8px 40px 0 40px'
          ),
          detailCard(
            `Approved via <strong>{{channelName}}</strong> channel.`,
            B.greenLight,
            B.green
          ),
          centeredCta('View Event', '{{eventLink}}', B.green),
        ].join('\n'),
      })

    // ── Event rejected ──
    case 'event_rejected':
      return wrapLayout({
        previewText: 'Your event "{{eventTitle}}" was not approved',
        content: [
          heroHeading('- Event Update -', 'Event Not<br />Approved'),
          contentSection(
            `<mj-text align="center" padding="0" font-size="16px">
              Your event <strong>{{eventTitle}}</strong> was not approved.
            </mj-text>`,
            '8px 40px 0 40px'
          ),
          vars.reason
            ? detailCard(`<strong>Reason</strong><br />{{reason}}`, B.redLight, B.red)
            : '',
          contentSection(
            `<mj-text align="center" padding-bottom="0" font-size="14px" color="${B.gray500}">
              You can edit your event and resubmit it for approval.
            </mj-text>`,
            '8px 40px 16px 40px'
          ),
          centeredCta('View Event', '{{eventLink}}'),
        ].filter(Boolean).join('\n'),
      })

    // ── Event cancelled ──
    case 'event_cancelled':
      return wrapLayout({
        previewText: '{{eventTitle}} has been cancelled',
        content: [
          heroHeading('- Event Update -', 'Event<br />Cancelled'),
          contentSection(
            `<mj-text align="center" padding="0" font-size="16px">
              The event <strong>{{eventTitle}}</strong> has been cancelled and removed from the calendar.
            </mj-text>`,
            '8px 40px 0 40px'
          ),
          detailCard(
            'This event is no longer scheduled. No further action is needed.',
            B.gray100,
            B.gray500
          ),
          contentSection(
            `<mj-text align="center" font-size="12px" color="${B.gray400}">You're receiving this because you were an attendee of this event.</mj-text>`,
            '8px 40px 24px 40px'
          ),
        ].join('\n'),
      })

    // ── Event invite ──
    case 'event_invite':
      return wrapLayout({
        previewText: 'You\'ve been added to "{{eventTitle}}"',
        content: [
          heroHeading("- You're Invited -", 'New Event<br />on Your Calendar'),
          contentSection(
            `<mj-text align="center" padding="0" font-size="16px">
              You've been added as an attendee to <strong>{{eventTitle}}</strong>.
            </mj-text>`,
            '8px 40px 0 40px'
          ),
          vars.eventDate
            ? detailCard(`<strong>When</strong><br />{{eventDate}}<br />{{eventTime}}`)
            : '',
          // RSVP action buttons
          vars.eventId ? `
    <mj-section background-color="${B.white}" padding="8px 40px 0 40px">
      <mj-column>
        <mj-text align="center" font-size="13px" color="${B.gray500}" padding-bottom="12px">
          Will you attend?
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="${B.white}" padding="0 40px 8px 40px">
      <mj-column>
        <mj-button href="{{appUrl}}/calendar?eventId={{eventId}}&rsvp=accept" background-color="${B.green}" color="${B.white}" align="center" border-radius="24px" inner-padding="12px 28px" font-size="14px" font-weight="600">
          Accept
        </mj-button>
      </mj-column>
      <mj-column>
        <mj-button href="{{appUrl}}/calendar?eventId={{eventId}}&rsvp=maybe" background-color="#f59e0b" color="${B.white}" align="center" border-radius="24px" inner-padding="12px 28px" font-size="14px" font-weight="600">
          Maybe
        </mj-button>
      </mj-column>
      <mj-column>
        <mj-button href="{{appUrl}}/calendar?eventId={{eventId}}&rsvp=decline" background-color="${B.red}" color="${B.white}" align="center" border-radius="24px" inner-padding="12px 28px" font-size="14px" font-weight="600">
          Decline
        </mj-button>
      </mj-column>
    </mj-section>` : '',
          centeredCta('View Event', '{{eventLink}}'),
        ].filter(Boolean).join('\n'),
      })

    // ── Maintenance: Ticket Submitted (to submitter) ──
    case 'maintenance_submitted':
      return wrapLayout({
        previewText: 'Your maintenance request {{ticketNumber}} has been submitted',
        content: [
          heroHeading('- Maintenance Request -', 'Request<br />Submitted'),
          contentSection(
            `<mj-text align="center" padding="0" font-size="16px">
              Your maintenance request has been received and is now in our queue.
            </mj-text>`,
            '8px 40px 0 40px'
          ),
          detailCard(
            `<strong>{{ticketNumber}}</strong><br />{{ticketTitle}}<br /><br /><strong>Priority:</strong> {{priority}}`,
            B.blueLight,
            B.blue
          ),
          centeredCta('View Request', '{{ticketLink}}'),
          contentSection(
            `<mj-text align="center" font-size="12px" color="${B.gray400}">We'll keep you updated as your request is processed.</mj-text>`,
            '8px 40px 24px 40px'
          ),
        ].join('\n'),
      })

    // ── Maintenance: Ticket Assigned (to assignee) ──
    case 'maintenance_assigned':
      return wrapLayout({
        previewText: 'Maintenance ticket {{ticketNumber}} has been assigned to you',
        content: [
          heroHeading('- Work Order -', 'Ticket<br />Assigned to You'),
          contentSection(
            `<mj-text align="center" padding="0" font-size="16px">
              A maintenance ticket has been assigned to you for action.
            </mj-text>`,
            '8px 40px 0 40px'
          ),
          detailCard(
            `<strong>{{ticketNumber}}</strong><br />{{ticketTitle}}<br /><br /><strong>Priority:</strong> {{priority}}<br /><strong>Category:</strong> {{category}}`,
            B.blueLight,
            B.blue
          ),
          centeredCta('View Ticket', '{{ticketLink}}'),
        ].join('\n'),
      })

    // ── Maintenance: Ticket Claimed (to Head) ──
    case 'maintenance_claimed':
      return wrapLayout({
        previewText: '{{technicianName}} has claimed ticket {{ticketNumber}}',
        content: [
          heroHeading('- Work Order Update -', 'Ticket<br />Claimed'),
          contentSection(
            `<mj-text align="center" padding="0" font-size="16px">
              <strong>{{technicianName}}</strong> has self-claimed ticket {{ticketNumber}} and will begin work soon.
            </mj-text>`,
            '8px 40px 0 40px'
          ),
          detailCard(
            `<strong>{{ticketNumber}}</strong><br />{{ticketTitle}}<br /><br /><strong>Assigned to:</strong> {{technicianName}}`,
            B.greenLight,
            B.green
          ),
          centeredCta('View Ticket', '{{ticketLink}}', B.green),
        ].join('\n'),
      })

    // ── Maintenance: In Progress (to submitter) ──
    case 'maintenance_in_progress':
      return wrapLayout({
        previewText: 'Work has begun on your request {{ticketNumber}}',
        content: [
          heroHeading('- Maintenance Update -', 'Work<br />In Progress'),
          contentSection(
            `<mj-text align="center" padding="0" font-size="16px">
              Good news — work has started on your maintenance request.
            </mj-text>`,
            '8px 40px 0 40px'
          ),
          detailCard(
            `<strong>{{ticketNumber}}</strong><br />{{ticketTitle}}<br /><br /><strong>Assigned to:</strong> {{technicianName}}`,
            B.greenLight,
            B.green
          ),
          centeredCta('View Request', '{{ticketLink}}', B.green),
        ].join('\n'),
      })

    // ── Maintenance: On Hold (to submitter and Head) ──
    case 'maintenance_on_hold':
      return wrapLayout({
        previewText: 'Maintenance request {{ticketNumber}} is temporarily on hold',
        content: [
          heroHeading('- Maintenance Update -', 'Request<br />On Hold'),
          contentSection(
            `<mj-text align="center" padding="0" font-size="16px">
              Your maintenance request has been temporarily placed on hold.
            </mj-text>`,
            '8px 40px 0 40px'
          ),
          detailCard(
            `<strong>{{ticketNumber}}</strong><br />{{ticketTitle}}<br /><br /><strong>Reason:</strong> {{holdReason}}`,
            B.gray100,
            B.gray500
          ),
          centeredCta('View Request', '{{ticketLink}}'),
          contentSection(
            `<mj-text align="center" font-size="12px" color="${B.gray400}">We'll update you when work resumes.</mj-text>`,
            '8px 40px 24px 40px'
          ),
        ].join('\n'),
      })

    // ── Maintenance: QA Ready (to Head) ──
    case 'maintenance_qa_ready':
      return wrapLayout({
        previewText: 'Ticket {{ticketNumber}} is ready for QA review',
        content: [
          heroHeading('- QA Review Needed -', 'Ready for<br />Approval'),
          contentSection(
            `<mj-text align="center" padding="0" font-size="16px">
              A maintenance ticket is ready for your QA review and sign-off.
            </mj-text>`,
            '8px 40px 0 40px'
          ),
          detailCard(
            `<strong>{{ticketNumber}}</strong><br />{{ticketTitle}}<br /><br /><strong>Completed by:</strong> {{technicianName}}`,
            B.blueLight,
            B.blue
          ),
          centeredCta('Review & Approve', '{{ticketLink}}'),
        ].join('\n'),
      })

    // ── Maintenance: Done (to submitter) ──
    case 'maintenance_done':
      return wrapLayout({
        previewText: 'Your maintenance request {{ticketNumber}} has been completed',
        content: [
          heroHeading('- All Done -', 'Request<br />Completed'),
          contentSection(
            `<mj-text align="center" padding="0" font-size="16px">
              Your maintenance request has been completed and closed.
            </mj-text>`,
            '8px 40px 0 40px'
          ),
          detailCard(
            `<strong>{{ticketNumber}}</strong><br />{{ticketTitle}}`,
            B.greenLight,
            B.green
          ),
          centeredCta('View Details', '{{ticketLink}}', B.green),
          contentSection(
            `<mj-text align="center" font-size="12px" color="${B.gray400}">Thank you for using Lionheart maintenance.</mj-text>`,
            '8px 40px 24px 40px'
          ),
        ].join('\n'),
      })

    // ── Maintenance: Urgent Alert (to Head/admin) ──
    case 'maintenance_urgent':
      return wrapLayout({
        previewText: 'URGENT: New maintenance request {{ticketNumber}} requires immediate attention',
        content: [
          heroHeading('- Urgent Alert -', 'Urgent<br />Maintenance Request'),
          contentSection(
            `<mj-text align="center" padding="0" font-size="16px">
              An <strong>URGENT</strong> maintenance request has been submitted and requires immediate attention.
            </mj-text>`,
            '8px 40px 0 40px'
          ),
          detailCard(
            `<strong>{{ticketNumber}}</strong><br />{{ticketTitle}}<br /><br /><strong>Category:</strong> {{category}}<br /><strong>Location:</strong> {{location}}`,
            B.redLight,
            B.red
          ),
          centeredCta('View Urgent Ticket', '{{ticketLink}}'),
        ].join('\n'),
      })

    // ── Maintenance: Stale Alert (to Head) ──
    case 'maintenance_stale':
      return wrapLayout({
        previewText: 'Ticket {{ticketNumber}} has been unassigned for 48+ hours',
        content: [
          heroHeading('- Action Required -', 'Unassigned<br />Ticket Alert'),
          contentSection(
            `<mj-text align="center" padding="0" font-size="16px">
              A maintenance ticket has been in the backlog for over 48 hours without assignment.
            </mj-text>`,
            '8px 40px 0 40px'
          ),
          detailCard(
            `<strong>{{ticketNumber}}</strong><br />{{ticketTitle}}<br /><br /><strong>Priority:</strong> {{priority}}<br /><strong>Age:</strong> {{ticketAge}}`,
            B.redLight,
            B.red
          ),
          centeredCta('Assign Now', '{{ticketLink}}'),
        ].join('\n'),
      })

    // ── Maintenance: QA Rejected (to technician) ──
    case 'maintenance_qa_rejected':
      return wrapLayout({
        previewText: 'QA review for {{ticketNumber}} was not approved — action required',
        content: [
          heroHeading('- QA Update -', 'Review Not<br />Approved'),
          contentSection(
            `<mj-text align="center" padding="0" font-size="16px">
              Your QA submission for ticket {{ticketNumber}} was not approved. Please review the feedback and resubmit.
            </mj-text>`,
            '8px 40px 0 40px'
          ),
          detailCard(
            `<strong>{{ticketNumber}}</strong><br />{{ticketTitle}}<br /><br /><strong>Feedback:</strong> {{rejectionNote}}`,
            B.redLight,
            B.red
          ),
          centeredCta('View Ticket', '{{ticketLink}}'),
        ].join('\n'),
      })

    // ── Maintenance: Repeat Repair Alert ──
    case 'maintenance_repeat_repair':
      return wrapLayout({
        previewText: 'Asset {{assetName}} has had {{repairCount}} repairs in the last 12 months',
        content: [
          heroHeading('- Asset Alert -', 'Repeat Repair<br />Detected'),
          contentSection(
            `<mj-text align="center" padding="0" font-size="16px">
              Asset <strong>{{assetName}}</strong> ({{assetNumber}}) has required <strong>{{repairCount}} repairs</strong> in the past 12 months, indicating a pattern of recurring failures.
            </mj-text>`,
            '8px 40px 0 40px'
          ),
          detailCard(
            `<strong>Asset:</strong> {{assetName}} ({{assetNumber}})<br /><br /><strong>Repairs in Last 12 Months:</strong> {{repairCount}}<br /><br />Consider scheduling a full inspection or evaluating replacement to prevent ongoing maintenance costs.`,
            B.redLight,
            B.red
          ),
          centeredCta('View Asset', '{{assetUrl}}', B.green),
        ].join('\n'),
      })

    // ── Maintenance: Cost Threshold Alert ──
    case 'maintenance_cost_threshold':
      return wrapLayout({
        previewText: 'Repair costs for {{assetName}} have exceeded the replacement threshold',
        content: [
          heroHeading('- Cost Alert -', 'Repair Cost<br />Threshold Exceeded'),
          contentSection(
            `<mj-text align="center" padding="0" font-size="16px">
              Cumulative repair costs for <strong>{{assetName}}</strong> have exceeded <strong>{{pct}}%</strong> of its replacement cost, triggering a replace-vs-repair review.
            </mj-text>`,
            '8px 40px 0 40px'
          ),
          detailCard(
            '<strong>Asset:</strong> {{assetName}} ({{assetNumber}})<br /><br /><strong>Cumulative Repair Cost:</strong> ${{cumulativeCost}}<br /><strong>Replacement Cost:</strong> ${{replacementCost}}<br /><strong>Threshold:</strong> {{pct}}%<br /><br /><strong>AI Recommendation:</strong><br />{{recommendation}}',
            B.redLight,
            B.red
          ),
          centeredCta('View Asset', '{{assetUrl}}', B.green),
        ].join('\n'),
      })

    // ── Maintenance: End of Life Alert ──
    case 'maintenance_end_of_life':
      return wrapLayout({
        previewText: 'Asset {{assetName}} has reached its expected end of life',
        content: [
          heroHeading('- Lifecycle Alert -', 'Asset End<br />of Life Reached'),
          contentSection(
            `<mj-text align="center" padding="0" font-size="16px">
              Asset <strong>{{assetName}}</strong> has exceeded its expected lifespan of <strong>{{expectedLifespan}} years</strong> and may require replacement evaluation.
            </mj-text>`,
            '8px 40px 0 40px'
          ),
          detailCard(
            `<strong>Asset:</strong> {{assetName}} ({{assetNumber}})<br /><br /><strong>Purchase Year:</strong> {{purchaseYear}}<br /><strong>Expected Lifespan:</strong> {{expectedLifespan}} years<br /><br />Please evaluate whether to continue operating, schedule a major overhaul, or initiate the replacement process.`,
            B.gray100,
            B.gray500
          ),
          centeredCta('View Asset', '{{assetUrl}}', B.green),
        ].join('\n'),
      })

    // ── IT Help Desk: Ticket Submitted (to submitter) ──
    case 'it_ticket_submitted':
      return wrapLayout({
        previewText: 'Your IT request {{ticketNumber}} has been submitted',
        content: [
          heroHeading('- IT Help Desk -', 'Request<br />Submitted'),
          contentSection(
            `<mj-text align="center" padding="0" font-size="16px">
              Your IT request has been received and is now in our queue.
            </mj-text>`,
            '8px 40px 0 40px'
          ),
          detailCard(
            `<strong>{{ticketNumber}}</strong><br />{{ticketTitle}}<br /><br /><strong>Category:</strong> {{category}}`,
            B.blueLight,
            B.blue
          ),
          centeredCta('View Request', '{{ticketLink}}'),
          contentSection(
            `<mj-text align="center" font-size="12px" color="${B.gray400}">We'll keep you updated as your request is processed.</mj-text>`,
            '8px 40px 24px 40px'
          ),
        ].join('\n'),
      })

    // ── IT Help Desk: Ticket Assigned (to assignee) ──
    case 'it_ticket_assigned':
      return wrapLayout({
        previewText: 'IT ticket {{ticketNumber}} has been assigned to you',
        content: [
          heroHeading('- IT Help Desk -', 'Ticket<br />Assigned to You'),
          contentSection(
            `<mj-text align="center" padding="0" font-size="16px">
              An IT ticket has been assigned to you for action.
            </mj-text>`,
            '8px 40px 0 40px'
          ),
          detailCard(
            `<strong>{{ticketNumber}}</strong><br />{{ticketTitle}}<br /><br /><strong>Priority:</strong> {{priority}}<br /><strong>Category:</strong> {{category}}`,
            B.blueLight,
            B.blue
          ),
          centeredCta('View Ticket', '{{ticketLink}}'),
        ].join('\n'),
      })

    // ── IT Help Desk: In Progress (to submitter) ──
    case 'it_ticket_in_progress':
      return wrapLayout({
        previewText: 'Work has begun on your IT request {{ticketNumber}}',
        content: [
          heroHeading('- IT Help Desk -', 'Work<br />In Progress'),
          contentSection(
            `<mj-text align="center" padding="0" font-size="16px">
              Good news — work has started on your IT request.
            </mj-text>`,
            '8px 40px 0 40px'
          ),
          detailCard(
            `<strong>{{ticketNumber}}</strong><br />{{ticketTitle}}`,
            B.greenLight,
            B.green
          ),
          centeredCta('View Request', '{{ticketLink}}', B.green),
        ].join('\n'),
      })

    // ── IT Help Desk: On Hold (to submitter) ──
    case 'it_ticket_on_hold':
      return wrapLayout({
        previewText: 'IT request {{ticketNumber}} is temporarily on hold',
        content: [
          heroHeading('- IT Help Desk -', 'Request<br />On Hold'),
          contentSection(
            `<mj-text align="center" padding="0" font-size="16px">
              Your IT request has been temporarily placed on hold.
            </mj-text>`,
            '8px 40px 0 40px'
          ),
          detailCard(
            `<strong>{{ticketNumber}}</strong><br />{{ticketTitle}}`,
            B.gray100,
            B.gray500
          ),
          centeredCta('View Request', '{{ticketLink}}'),
          contentSection(
            `<mj-text align="center" font-size="12px" color="${B.gray400}">We'll update you when work resumes.</mj-text>`,
            '8px 40px 24px 40px'
          ),
        ].join('\n'),
      })

    // ── IT Help Desk: Done (to submitter) ──
    case 'it_ticket_done':
      return wrapLayout({
        previewText: 'Your IT request {{ticketNumber}} has been resolved',
        content: [
          heroHeading('- All Done -', 'Request<br />Resolved'),
          contentSection(
            `<mj-text align="center" padding="0" font-size="16px">
              Your IT request has been resolved and closed.
            </mj-text>`,
            '8px 40px 0 40px'
          ),
          detailCard(
            `<strong>{{ticketNumber}}</strong><br />{{ticketTitle}}`,
            B.greenLight,
            B.green
          ),
          centeredCta('View Details', '{{ticketLink}}', B.green),
          contentSection(
            `<mj-text align="center" font-size="12px" color="${B.gray400}">Thank you for using IT Help Desk.</mj-text>`,
            '8px 40px 24px 40px'
          ),
        ].join('\n'),
      })

    // ── IT Help Desk: Urgent Alert (to IT coordinators) ──
    case 'it_ticket_urgent':
      return wrapLayout({
        previewText: 'URGENT: IT request {{ticketNumber}} requires immediate attention',
        content: [
          heroHeading('- Urgent Alert -', 'Urgent<br />IT Request'),
          contentSection(
            `<mj-text align="center" padding="0" font-size="16px">
              An <strong>URGENT</strong> IT request has been submitted and requires immediate attention.
            </mj-text>`,
            '8px 40px 0 40px'
          ),
          detailCard(
            `<strong>{{ticketNumber}}</strong><br />{{ticketTitle}}<br /><br /><strong>Category:</strong> {{category}}<br /><strong>Location:</strong> {{location}}`,
            B.redLight,
            B.red
          ),
          centeredCta('View Urgent Ticket', '{{ticketLink}}'),
        ].join('\n'),
      })

    default:
      throw new Error(`Unknown email template: ${template}`)
  }
}

// ─── Compile & Render ────────────────────────────────────────────────────────

function interpolate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}

export interface RenderEmailResult {
  html: string
  subject: string
  text: string
}

const SUBJECTS: Record<EmailTemplate, string> = {
  welcome: 'Welcome to Lionheart',
  email_verification: 'Verify your email address',
  password_setup: "You're invited to Lionheart",
  password_reset: 'Reset your password',
  event_updated: 'Event rescheduled: {{eventTitle}}',
  event_approved: 'Event approved: {{eventTitle}}',
  event_rejected: 'Event not approved: {{eventTitle}}',
  event_cancelled: 'Event cancelled: {{eventTitle}}',
  event_invite: "You're invited: {{eventTitle}}",
  // Maintenance
  maintenance_submitted: 'Maintenance request {{ticketNumber}} received',
  maintenance_assigned: 'Work order assigned: {{ticketNumber}}',
  maintenance_claimed: '{{technicianName}} claimed ticket {{ticketNumber}}',
  maintenance_in_progress: 'Work started on your request {{ticketNumber}}',
  maintenance_on_hold: 'Maintenance request {{ticketNumber}} is on hold',
  maintenance_qa_ready: 'QA review needed: {{ticketNumber}}',
  maintenance_done: 'Request {{ticketNumber}} completed',
  maintenance_urgent: 'URGENT maintenance request: {{ticketNumber}}',
  maintenance_stale: 'Action required: Unassigned ticket {{ticketNumber}}',
  maintenance_qa_rejected: 'QA not approved for {{ticketNumber}}',
  // Maintenance asset intelligence alerts
  maintenance_repeat_repair: 'Repeat Repair Alert: {{assetName}}',
  maintenance_cost_threshold: 'Repair Cost Threshold Exceeded: {{assetName}}',
  maintenance_end_of_life: 'Asset End of Life: {{assetName}}',
  // IT Help Desk
  it_ticket_submitted: 'IT request {{ticketNumber}} received',
  it_ticket_assigned: 'IT ticket assigned: {{ticketNumber}}',
  it_ticket_in_progress: 'Work started on your IT request {{ticketNumber}}',
  it_ticket_on_hold: 'IT request {{ticketNumber}} is on hold',
  it_ticket_done: 'IT request {{ticketNumber}} resolved',
  it_ticket_urgent: 'URGENT IT request: {{ticketNumber}}',
}

const TEXT_BODIES: Record<EmailTemplate, string> = {
  welcome: 'Welcome to Lionheart! Your account at {{orgName}} is ready. Set your password: {{setupLink}}',
  email_verification: 'Hi {{firstName}}, welcome to {{orgName}}! Please verify your email address to get started: {{verificationLink}} (expires in 24 hours).',
  password_setup: "You've been invited to join {{orgName}} on Lionheart. Set your password: {{setupLink}}",
  password_reset: 'Hi {{firstName}}, reset your password for {{orgName}} on Lionheart: {{resetLink}} (expires in 1 hour). If you did not request this, ignore this email.',
  event_updated: '"{{eventTitle}}" was rescheduled by {{updatedByName}}. New time: {{eventDate}}, {{eventTime}}. View: {{eventLink}}',
  event_approved: 'Your event "{{eventTitle}}" was approved via {{channelName}} channel. View: {{eventLink}}',
  event_rejected: 'Your event "{{eventTitle}}" was not approved. {{reason}} View: {{eventLink}}',
  event_cancelled: '"{{eventTitle}}" has been cancelled and removed from the calendar.',
  event_invite: 'You\'ve been added to "{{eventTitle}}". View: {{eventLink}}',
  // Maintenance
  maintenance_submitted: 'Your maintenance request {{ticketNumber}} "{{ticketTitle}}" has been received. Priority: {{priority}}. View: {{ticketLink}}',
  maintenance_assigned: 'Maintenance ticket {{ticketNumber}} "{{ticketTitle}}" has been assigned to you. Priority: {{priority}}. View: {{ticketLink}}',
  maintenance_claimed: '{{technicianName}} has claimed ticket {{ticketNumber}} "{{ticketTitle}}". View: {{ticketLink}}',
  maintenance_in_progress: 'Work has started on your maintenance request {{ticketNumber}} "{{ticketTitle}}". Assigned to: {{technicianName}}. View: {{ticketLink}}',
  maintenance_on_hold: 'Maintenance request {{ticketNumber}} "{{ticketTitle}}" is on hold. Reason: {{holdReason}}. View: {{ticketLink}}',
  maintenance_qa_ready: 'Ticket {{ticketNumber}} "{{ticketTitle}}" is ready for QA review. Completed by: {{technicianName}}. View: {{ticketLink}}',
  maintenance_done: 'Maintenance request {{ticketNumber}} "{{ticketTitle}}" has been completed and closed. View: {{ticketLink}}',
  maintenance_urgent: 'URGENT: Maintenance request {{ticketNumber}} "{{ticketTitle}}" requires immediate attention. Category: {{category}}. View: {{ticketLink}}',
  maintenance_stale: 'Ticket {{ticketNumber}} "{{ticketTitle}}" has been unassigned for 48+ hours. Priority: {{priority}}. View: {{ticketLink}}',
  maintenance_qa_rejected: 'QA review for {{ticketNumber}} "{{ticketTitle}}" was not approved. Feedback: {{rejectionNote}}. View: {{ticketLink}}',
  // Maintenance asset intelligence alerts
  maintenance_repeat_repair: 'Asset {{assetName}} ({{assetNumber}}) has had {{repairCount}} repairs in the last 12 months. View: {{assetUrl}}',
  maintenance_cost_threshold: 'Cumulative repair cost (${{cumulativeCost}}) for {{assetName}} has exceeded {{pct}}% of replacement cost (${{replacementCost}}). AI Recommendation: {{recommendation}}. View: {{assetUrl}}',
  maintenance_end_of_life: 'Asset {{assetName}} ({{assetNumber}}) purchased in {{purchaseYear}} has exceeded its expected lifespan of {{expectedLifespan}} years. View: {{assetUrl}}',
  // IT Help Desk
  it_ticket_submitted: 'Your IT request {{ticketNumber}} "{{ticketTitle}}" has been received. Category: {{category}}. View: {{ticketLink}}',
  it_ticket_assigned: 'IT ticket {{ticketNumber}} "{{ticketTitle}}" has been assigned to you. Priority: {{priority}}. View: {{ticketLink}}',
  it_ticket_in_progress: 'Work has started on your IT request {{ticketNumber}} "{{ticketTitle}}". View: {{ticketLink}}',
  it_ticket_on_hold: 'IT request {{ticketNumber}} "{{ticketTitle}}" is on hold. View: {{ticketLink}}',
  it_ticket_done: 'IT request {{ticketNumber}} "{{ticketTitle}}" has been resolved and closed. View: {{ticketLink}}',
  it_ticket_urgent: 'URGENT: IT request {{ticketNumber}} "{{ticketTitle}}" requires immediate attention. Category: {{category}}. View: {{ticketLink}}',
}

/**
 * Render a Lionheart-branded email template.
 */
export function renderEmail(template: EmailTemplate, vars: TemplateVars): RenderEmailResult {
  // Inject current year for footer copyright
  const enrichedVars = {
    ...vars,
    currentYear: new Date().getFullYear().toString(),
  }

  const mjmlSource = getTemplateMjml(template, enrichedVars)
  const interpolated = interpolate(mjmlSource, enrichedVars)

  const { html, errors } = mjml2html(interpolated, {
    validationLevel: 'soft',
  })

  if (errors.length > 0) {
    logger.warn({ template, warnings: errors.map((e: { message: string }) => e.message) }, 'MJML warnings')
  }

  return {
    html,
    subject: interpolate(SUBJECTS[template], enrichedVars),
    text: interpolate(TEXT_BODIES[template], enrichedVars),
  }
}
