/**
 * Lionheart-branded MJML email templates.
 *
 * Layout, brand tokens, and MJML helpers are in email-layout.ts.
 * Design: matches lionheartapp.com — near-black on warm white, Inter, monochrome restraint.
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
  ledeText,
  microNote,
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
  | 'maintenance_repeat_repair'
  | 'maintenance_cost_threshold'
  | 'maintenance_end_of_life'
  | 'it_ticket_submitted'
  | 'it_ticket_assigned'
  | 'it_ticket_in_progress'
  | 'it_ticket_on_hold'
  | 'it_ticket_done'
  | 'it_ticket_urgent'
  | 'mfa_email_code'
  | 'conference_invite'
  | 'conference_invite_existing'

type TemplateVars = Record<string, string | undefined>

// ─── Reusable bits ───────────────────────────────────────────────────────────

/** Small status pill rendered as an inline span (email-safe). */
function pill(label: string, variant: 'green' | 'red' | 'amber' | 'gray' = 'gray'): string {
  const palette = {
    green: { bg: B.greenLight, fg: B.green },
    red: { bg: B.redLight, fg: B.red },
    amber: { bg: B.amberLight, fg: B.amber },
    gray: { bg: B.gray50, fg: B.textSec },
  }[variant]
  return `<span style="display:inline-block;background:${palette.bg};color:${palette.fg};padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;letter-spacing:0.01em;">${label}</span>`
}

/** Monospace ticket-ID tag. */
function ticketTag(id: string): string {
  return `<span style="display:inline-block;font-family:'SF Mono',Menlo,monospace;font-size:12px;font-weight:600;color:${B.nearBlack};background:${B.surface};border:1px solid ${B.border};padding:2px 8px;border-radius:5px;letter-spacing:0.02em;">${id}</span>`
}

/** Key/value rows rendered inside a detailCard. */
function kvRows(rows: ReadonlyArray<readonly [string, string]>): string {
  return rows
    .map(
      ([k, v], i) =>
        `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0;${i === 0 ? '' : `border-top:1px solid ${B.borderSoft};`}padding:${i === 0 ? '0' : '6px'} 0;"><tr><td style="padding:6px 0;color:${B.textSec};font-size:13.5px;font-weight:500;">${k}</td><td align="right" style="padding:6px 0;color:${B.nearBlack};font-size:14px;font-weight:600;">${v}</td></tr></table>`
    )
    .join('')
}

// ─── Per-template MJML ───────────────────────────────────────────────────────

// eslint-disable-next-line complexity
function getTemplateMjml(template: EmailTemplate, vars: TemplateVars): string {
  switch (template) {
    // ── Account ──────────────────────────────────────────────────────────────
    case 'welcome':
      return wrapLayout({
        previewText: 'Your account is ready — set your password to get started',
        content: [
          heroHeading('Account ready', 'Welcome to Lionheart,<br />{{firstName}}.'),
          ledeText(
            `Your administrator at <strong style="color:${B.nearBlack};">{{orgName}}</strong> set up an account for you. Set a password and you're in — calendars, events, work orders, and inventory, all in one place.`
          ),
          centeredCta('Set your password', '{{setupLink}}'),
          microNote(`This link expires {{expiresAt}}. Need a new one? Ask your admin to resend.`),
        ].join('\n'),
        blueBand: {
          text: `<strong style="color:#ffffff;">Lionheart</strong> is the single workspace for schools that run on details — events, facilities, IT, athletics, and the people behind it all.`,
          ctaLabel: "See what's inside",
          ctaUrl: '{{appUrl}}',
        },
      })

    case 'password_setup':
      return wrapLayout({
        previewText: 'Set your password to join {{orgName}} on Lionheart',
        content: [
          heroHeading("You're invited", 'Join your team<br />on Lionheart.'),
          ledeText(
            `<strong style="color:${B.nearBlack};">{{orgName}}</strong> invited you to their workspace. Set a password to access the calendar, submit requests, and stay in the loop with your team.`
          ),
          centeredCta('Get started', '{{setupLink}}'),
          microNote(`Invite expires {{expiresAt}}. If you weren't expecting this, you can ignore it.`),
        ].join('\n'),
      })

    case 'password_reset':
      return wrapLayout({
        previewText: 'Reset your password for {{orgName}} on Lionheart',
        content: [
          heroHeading('Password reset', 'Reset your password.'),
          ledeText(
            `Hi {{firstName}} — we got a request to reset your Lionheart password for <strong style="color:${B.nearBlack};">{{orgName}}</strong>. Use the button below to set a new one. The link is good for one hour.`
          ),
          centeredCta('Reset password', '{{resetLink}}'),
          microNote(`Didn't request this? You can ignore this email. Your password won't change.`),
        ].join('\n'),
      })

    case 'email_verification':
      return wrapLayout({
        previewText: 'Verify your email address to get started with {{orgName}}',
        content: [
          heroHeading('One last step', 'Verify your email.'),
          ledeText(
            `Welcome to <strong style="color:${B.nearBlack};">Lionheart</strong>. Click below to confirm this is your address and activate your account at {{orgName}}.`
          ),
          centeredCta('Verify email', '{{verificationLink}}'),
          microNote(`This link expires in 24 hours. Didn't sign up? Just ignore this email.`),
        ].join('\n'),
      })

    // ── Events ──────────────────────────────────────────────────────────────
    case 'event_invite':
      return wrapLayout({
        previewText: 'You\'ve been added to "{{eventTitle}}"',
        content: [
          heroHeading("You're invited", 'New event<br />on your calendar.'),
          ledeText(
            `You've been added as an attendee to <strong style="color:${B.nearBlack};">{{eventTitle}}</strong>.`
          ),
          vars.eventDate
            ? detailCard(kvRows([
                ['When', '{{eventDate}} · {{eventTime}}'],
              ]))
            : '',
          vars.eventId
            ? `
    <mj-section background-color="${B.surface}" padding="0 32px 6px 32px">
      <mj-column>
        <mj-text padding="0 0 10px 0" align="left" font-size="13px" color="${B.textSec}" font-weight="500">
          Will you attend?
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="${B.surface}" padding="0 32px 8px 32px">
      <mj-column>
        <mj-button href="{{appUrl}}/calendar?eventId={{eventId}}&rsvp=accept" background-color="${B.green}" color="${B.white}" align="left" border-radius="8px" inner-padding="10px 18px" padding="0 6px 0 0" font-size="13.5px" font-weight="600">
          Accept
        </mj-button>
      </mj-column>
      <mj-column>
        <mj-button href="{{appUrl}}/calendar?eventId={{eventId}}&rsvp=maybe" background-color="${B.amber}" color="${B.white}" align="left" border-radius="8px" inner-padding="10px 18px" padding="0 6px 0 0" font-size="13.5px" font-weight="600">
          Maybe
        </mj-button>
      </mj-column>
      <mj-column>
        <mj-button href="{{appUrl}}/calendar?eventId={{eventId}}&rsvp=decline" background-color="${B.red}" color="${B.white}" align="left" border-radius="8px" inner-padding="10px 18px" padding="0" font-size="13.5px" font-weight="600">
          Decline
        </mj-button>
      </mj-column>
    </mj-section>`
            : '',
          centeredCta('View event', '{{eventLink}}'),
        ].filter(Boolean).join('\n'),
      })

    case 'event_updated':
      return wrapLayout({
        previewText: '{{eventTitle}} has been rescheduled',
        content: [
          heroHeading('Event update', '{{eventTitle}}<br />has moved.'),
          ledeText(
            `<strong style="color:${B.nearBlack};">{{eventTitle}}</strong> was rescheduled by {{updatedByName}}.`
          ),
          detailCard(kvRows([
            ['New time', '{{eventDate}} · {{eventTime}}'],
          ])),
          centeredCta('View event', '{{eventLink}}'),
          microNote(`You're getting this because you're an attendee. RSVPs roll over — you don't need to respond again.`),
        ].join('\n'),
      })

    case 'event_approved':
      return wrapLayout({
        previewText: 'Your event "{{eventTitle}}" has been approved',
        content: [
          heroHeading('Approved', 'Your event<br />got the green light.'),
          ledeText(
            `<strong style="color:${B.nearBlack};">{{eventTitle}}</strong> was approved and is now on the master calendar.`
          ),
          detailCard(
            kvRows([
              ['Approved by', '{{channelName}} channel'],
              ['Status', pill('Live on calendar', 'green')],
            ]),
            B.greenLight,
            '#bbf7d0'
          ),
          centeredCta('View event', '{{eventLink}}', B.green),
        ].join('\n'),
      })

    case 'event_rejected':
      return wrapLayout({
        previewText: 'Your event "{{eventTitle}}" was not approved',
        content: [
          heroHeading('Event update', 'Event not approved.'),
          ledeText(
            `Your event <strong style="color:${B.nearBlack};">{{eventTitle}}</strong> wasn't approved this round.`
          ),
          vars.reason
            ? detailCard(kvRows([['Reason', '{{reason}}']]), B.redLight, '#fecaca')
            : '',
          microNote(`You can edit the event (date, location, etc.) and resubmit any time.`),
          centeredCta('Edit and resubmit', '{{eventLink}}'),
        ].filter(Boolean).join('\n'),
      })

    case 'event_cancelled':
      return wrapLayout({
        previewText: '{{eventTitle}} has been cancelled',
        content: [
          heroHeading('Event update', '{{eventTitle}}<br />was cancelled.'),
          ledeText(`The event was removed from the calendar by the organizer.`),
          detailCard(kvRows([['Status', pill('Cancelled', 'gray')]]), B.gray50, B.border),
          microNote(`No action needed. You're receiving this because you were on the attendee list.`),
        ].join('\n'),
      })

    // ── Maintenance ─────────────────────────────────────────────────────────
    case 'maintenance_submitted':
      return wrapLayout({
        previewText: 'Your maintenance request {{ticketNumber}} has been submitted',
        content: [
          heroHeading('Maintenance', 'We got your request.'),
          ledeText(`Your request is in the queue. We'll keep you posted as it moves.`),
          detailCard(kvRows([
            ['Ticket', ticketTag('{{ticketNumber}}')],
            ['Title', '{{ticketTitle}}'],
            ['Priority', '{{priority}}'],
          ])),
          centeredCta('Track your request', '{{ticketLink}}'),
        ].join('\n'),
      })

    case 'maintenance_assigned':
      return wrapLayout({
        previewText: 'Maintenance ticket {{ticketNumber}} has been assigned to you',
        content: [
          heroHeading('Work order', 'New ticket on your queue.'),
          ledeText(`This one is yours. Tap through for full context — photos, history, and location.`),
          detailCard(kvRows([
            ['Ticket', ticketTag('{{ticketNumber}}')],
            ['Title', '{{ticketTitle}}'],
            ['Priority', '{{priority}}'],
            ['Category', '{{category}}'],
          ])),
          centeredCta('View ticket', '{{ticketLink}}'),
        ].join('\n'),
      })

    case 'maintenance_claimed':
      return wrapLayout({
        previewText: '{{technicianName}} has claimed ticket {{ticketNumber}}',
        content: [
          heroHeading('Update', 'Ticket claimed.'),
          ledeText(
            `<strong style="color:${B.nearBlack};">{{technicianName}}</strong> self-claimed ticket {{ticketNumber}} and will start work shortly.`
          ),
          detailCard(
            kvRows([
              ['Ticket', ticketTag('{{ticketNumber}}')],
              ['Title', '{{ticketTitle}}'],
              ['Assigned to', '{{technicianName}}'],
              ['Status', pill('Claimed', 'green')],
            ]),
            B.greenLight,
            '#bbf7d0'
          ),
          centeredCta('View ticket', '{{ticketLink}}', B.green),
        ].join('\n'),
      })

    case 'maintenance_in_progress':
      return wrapLayout({
        previewText: 'Work has begun on your request {{ticketNumber}}',
        content: [
          heroHeading('Update', 'Work has started.'),
          ledeText(`Good news — someone's on it. We'll let you know when it's done.`),
          detailCard(
            kvRows([
              ['Ticket', ticketTag('{{ticketNumber}}')],
              ['Title', '{{ticketTitle}}'],
              ['Assigned to', '{{technicianName}}'],
              ['Status', pill('In progress', 'green')],
            ]),
            B.greenLight,
            '#bbf7d0'
          ),
          centeredCta('View progress', '{{ticketLink}}', B.green),
        ].join('\n'),
      })

    case 'maintenance_on_hold':
      return wrapLayout({
        previewText: 'Maintenance request {{ticketNumber}} is temporarily on hold',
        content: [
          heroHeading('Update', 'Request on hold.'),
          ledeText(`Your maintenance request is temporarily paused. Here's why:`),
          detailCard(
            kvRows([
              ['Ticket', ticketTag('{{ticketNumber}}')],
              ['Title', '{{ticketTitle}}'],
              ['Reason', '{{holdReason}}'],
              ['Status', pill('On hold', 'amber')],
            ]),
            B.amberLight,
            '#fde68a'
          ),
          centeredCta('View ticket', '{{ticketLink}}'),
          microNote(`We'll email you the moment work resumes.`),
        ].join('\n'),
      })

    case 'maintenance_qa_ready':
      return wrapLayout({
        previewText: 'Ticket {{ticketNumber}} is ready for QA review',
        content: [
          heroHeading('QA review', 'Ready for your sign-off.'),
          ledeText(`A maintenance ticket is ready for QA review.`),
          detailCard(kvRows([
            ['Ticket', ticketTag('{{ticketNumber}}')],
            ['Title', '{{ticketTitle}}'],
            ['Completed by', '{{technicianName}}'],
            ['Status', pill('Awaiting QA', 'amber')],
          ])),
          centeredCta('Review and approve', '{{ticketLink}}'),
        ].join('\n'),
      })

    case 'maintenance_done':
      return wrapLayout({
        previewText: 'Your maintenance request {{ticketNumber}} has been completed',
        content: [
          heroHeading('All done', 'Request completed.'),
          ledeText(`Your maintenance request has been resolved and closed.`),
          detailCard(
            kvRows([
              ['Ticket', ticketTag('{{ticketNumber}}')],
              ['Title', '{{ticketTitle}}'],
              ['Status', pill('Completed', 'green')],
            ]),
            B.greenLight,
            '#bbf7d0'
          ),
          centeredCta('View details', '{{ticketLink}}', B.green),
          microNote(`Thanks for using Lionheart maintenance.`),
        ].join('\n'),
      })

    case 'maintenance_urgent':
      return wrapLayout({
        previewText: 'URGENT: New maintenance request {{ticketNumber}} requires immediate attention',
        content: [
          heroHeading('Urgent', 'Immediate attention needed.'),
          ledeText(
            `An <strong style="color:${B.nearBlack};">urgent</strong> maintenance request was just submitted. Please review and assign.`
          ),
          detailCard(
            kvRows([
              ['Ticket', ticketTag('{{ticketNumber}}')],
              ['Title', '{{ticketTitle}}'],
              ['Category', '{{category}}'],
              ['Location', '{{location}}'],
              ['Priority', pill('Urgent', 'red')],
            ]),
            B.redLight,
            '#fecaca'
          ),
          centeredCta('View urgent ticket', '{{ticketLink}}', B.red),
        ].join('\n'),
      })

    case 'maintenance_stale':
      return wrapLayout({
        previewText: 'Ticket {{ticketNumber}} has been unassigned for 48+ hours',
        content: [
          heroHeading('Action required', 'Unassigned for 48+ hours.'),
          ledeText(`A maintenance ticket has been in the backlog for over 48 hours without assignment.`),
          detailCard(
            kvRows([
              ['Ticket', ticketTag('{{ticketNumber}}')],
              ['Title', '{{ticketTitle}}'],
              ['Priority', '{{priority}}'],
              ['Age', '{{ticketAge}}'],
            ]),
            B.amberLight,
            '#fde68a'
          ),
          centeredCta('Assign now', '{{ticketLink}}'),
        ].join('\n'),
      })

    case 'maintenance_qa_rejected':
      return wrapLayout({
        previewText: 'QA review for {{ticketNumber}} was not approved — action required',
        content: [
          heroHeading('QA update', 'Review not approved.'),
          ledeText(
            `Your QA submission for ticket {{ticketNumber}} wasn't approved. Have a look at the feedback and resubmit when ready.`
          ),
          detailCard(
            kvRows([
              ['Ticket', ticketTag('{{ticketNumber}}')],
              ['Title', '{{ticketTitle}}'],
              ['Feedback', '{{rejectionNote}}'],
            ]),
            B.redLight,
            '#fecaca'
          ),
          centeredCta('View ticket', '{{ticketLink}}'),
        ].join('\n'),
      })

    // ── Maintenance asset intelligence ──────────────────────────────────────
    case 'maintenance_repeat_repair':
      return wrapLayout({
        previewText: 'Asset {{assetName}} has had {{repairCount}} repairs in the last 12 months',
        content: [
          heroHeading('Asset intelligence', 'Repeat repair detected.'),
          ledeText(
            `<strong style="color:${B.nearBlack};">{{assetName}}</strong> (asset {{assetNumber}}) has needed <strong style="color:${B.nearBlack};">{{repairCount}} repairs</strong> in the past 12 months — that's a pattern worth a closer look.`
          ),
          detailCard(kvRows([
            ['Asset', '{{assetName}} ({{assetNumber}})'],
            ['Repairs (12 mo)', '{{repairCount}}'],
            ['Suggestion', 'Inspect or evaluate replacement'],
          ])),
          centeredCta('View asset', '{{assetUrl}}'),
        ].join('\n'),
      })

    case 'maintenance_cost_threshold':
      return wrapLayout({
        previewText: 'Repair costs for {{assetName}} have exceeded the replacement threshold',
        content: [
          heroHeading('Cost alert', 'Time for a replace-vs-repair call.'),
          ledeText(
            `Cumulative repair costs for <strong style="color:${B.nearBlack};">{{assetName}}</strong> now exceed <strong style="color:${B.nearBlack};">{{pct}}%</strong> of its replacement cost.`
          ),
          detailCard(kvRows([
            ['Asset', '{{assetName}} ({{assetNumber}})'],
            ['Cumulative repair', '${{cumulativeCost}}'],
            ['Replacement cost', '${{replacementCost}}'],
            ['Threshold', '{{pct}}%'],
          ])),
          detailCard(
            `<div style="font-size:11px;font-weight:600;color:${B.textMute};letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px;">Leo's recommendation</div><div style="font-size:14.5px;color:${B.nearBlack};line-height:1.55;">{{recommendation}}</div>`,
            B.surfaceAlt,
            B.border
          ),
          centeredCta('View asset', '{{assetUrl}}'),
        ].join('\n'),
      })

    case 'maintenance_end_of_life':
      return wrapLayout({
        previewText: 'Asset {{assetName}} has reached its expected end of life',
        content: [
          heroHeading('Lifecycle alert', 'Asset has reached<br />end of life.'),
          ledeText(
            `<strong style="color:${B.nearBlack};">{{assetName}}</strong> has passed its expected <strong style="color:${B.nearBlack};">{{expectedLifespan}}-year</strong> lifespan and may need replacement evaluation.`
          ),
          detailCard(
            kvRows([
              ['Asset', '{{assetName}} ({{assetNumber}})'],
              ['Purchase year', '{{purchaseYear}}'],
              ['Expected lifespan', '{{expectedLifespan}} years'],
            ]),
            B.gray50,
            B.border
          ),
          microNote(`Evaluate whether to continue operating, schedule a major overhaul, or start the replacement process.`),
          centeredCta('View asset', '{{assetUrl}}'),
        ].join('\n'),
      })

    // ── IT Help Desk ────────────────────────────────────────────────────────
    case 'it_ticket_submitted':
      return wrapLayout({
        previewText: 'Your IT request {{ticketNumber}} has been submitted',
        content: [
          heroHeading('IT help desk', 'We got your request.'),
          ledeText(`Your IT request is in the queue. We'll keep you updated as it moves.`),
          detailCard(kvRows([
            ['Ticket', ticketTag('{{ticketNumber}}')],
            ['Title', '{{ticketTitle}}'],
            ['Category', '{{category}}'],
          ])),
          centeredCta('Track your request', '{{ticketLink}}'),
        ].join('\n'),
      })

    case 'it_ticket_assigned':
      return wrapLayout({
        previewText: 'IT ticket {{ticketNumber}} has been assigned to you',
        content: [
          heroHeading('IT help desk', 'New ticket on your queue.'),
          ledeText(`An IT ticket has been assigned to you.`),
          detailCard(kvRows([
            ['Ticket', ticketTag('{{ticketNumber}}')],
            ['Title', '{{ticketTitle}}'],
            ['Priority', '{{priority}}'],
            ['Category', '{{category}}'],
          ])),
          centeredCta('View ticket', '{{ticketLink}}'),
        ].join('\n'),
      })

    case 'it_ticket_in_progress':
      return wrapLayout({
        previewText: 'Work has begun on your IT request {{ticketNumber}}',
        content: [
          heroHeading('Update', 'Work has started.'),
          ledeText(`Good news — IT is on your case.`),
          detailCard(
            kvRows([
              ['Ticket', ticketTag('{{ticketNumber}}')],
              ['Title', '{{ticketTitle}}'],
              ['Status', pill('In progress', 'green')],
            ]),
            B.greenLight,
            '#bbf7d0'
          ),
          centeredCta('View progress', '{{ticketLink}}', B.green),
        ].join('\n'),
      })

    case 'it_ticket_on_hold':
      return wrapLayout({
        previewText: 'IT request {{ticketNumber}} is temporarily on hold',
        content: [
          heroHeading('Update', 'Request on hold.'),
          ledeText(`Your IT request is paused for now.`),
          detailCard(
            kvRows([
              ['Ticket', ticketTag('{{ticketNumber}}')],
              ['Title', '{{ticketTitle}}'],
              ['Status', pill('On hold', 'amber')],
            ]),
            B.amberLight,
            '#fde68a'
          ),
          microNote(`We'll email when work resumes.`),
          centeredCta('View ticket', '{{ticketLink}}'),
        ].join('\n'),
      })

    case 'it_ticket_done':
      return wrapLayout({
        previewText: 'Your IT request {{ticketNumber}} has been resolved',
        content: [
          heroHeading('All done', 'IT request resolved.'),
          ledeText(`Your IT request is closed.`),
          detailCard(
            kvRows([
              ['Ticket', ticketTag('{{ticketNumber}}')],
              ['Title', '{{ticketTitle}}'],
              ['Status', pill('Resolved', 'green')],
            ]),
            B.greenLight,
            '#bbf7d0'
          ),
          centeredCta('View details', '{{ticketLink}}', B.green),
          microNote(`Thanks for using the IT help desk.`),
        ].join('\n'),
      })

    case 'it_ticket_urgent':
      return wrapLayout({
        previewText: 'URGENT: IT request {{ticketNumber}} requires immediate attention',
        content: [
          heroHeading('Urgent', 'IT request —<br />immediate attention needed.'),
          ledeText(
            `An <strong style="color:${B.nearBlack};">urgent</strong> IT request was just submitted.`
          ),
          detailCard(
            kvRows([
              ['Ticket', ticketTag('{{ticketNumber}}')],
              ['Title', '{{ticketTitle}}'],
              ['Category', '{{category}}'],
              ['Location', '{{location}}'],
              ['Priority', pill('Urgent', 'red')],
            ]),
            B.redLight,
            '#fecaca'
          ),
          centeredCta('View urgent ticket', '{{ticketLink}}', B.red),
        ].join('\n'),
      })

    // ── MFA ────────────────────────────────────────────────────────────────
    case 'mfa_email_code':
      return wrapLayout({
        previewText: 'Your verification code is {{code}}',
        content: [
          heroHeading('Sign-in code', 'Enter this code to<br />verify your identity.'),
          contentSection(
            `<div style="font-size:36px;font-weight:700;letter-spacing:0.3em;text-align:center;font-family:'SF Mono',Menlo,monospace;color:${B.nearBlack};padding:8px 0;">{{code}}</div>`
          ),
          ledeText(`This code expires in 5 minutes. If you didn't try to sign in, you can safely ignore this email.`),
        ].join('\n'),
      })

    // ── Conference invites ───────────────────────────────────────────────
    case 'conference_invite':
      return wrapLayout({
        previewText: '{{inviterOrgName}} invited {{schoolName}} to join {{conferenceName}}',
        content: [
          heroHeading("You're invited", 'Join an athletic<br />conference on Lionheart.'),
          ledeText(
            `<strong style="color:${B.nearBlack};">{{inviterOrgName}}</strong> invited <strong style="color:${B.nearBlack};">{{schoolName}}</strong> to join the <strong style="color:${B.nearBlack};">{{conferenceName}}</strong> athletic conference.`
          ),
          ledeText(
            `Lionheart is a platform that helps schools manage operations, athletics, and events. As a conference member, your teams will share schedules and scores automatically — no more double-entry or emailing PDFs.`
          ),
          ledeText(`Your school gets a <strong style="color:${B.nearBlack};">free 30-day trial</strong> — no credit card required.`),
          centeredCta('Join conference & start free trial', '{{signupUrl}}'),
          microNote(`This invitation expires in 30 days. Only game schedules and team names are shared — rosters and student data stay private to your school.`),
        ].join('\n'),
      })

    case 'conference_invite_existing':
      return wrapLayout({
        previewText: '{{inviterOrgName}} invited your school to join {{conferenceName}}',
        content: [
          heroHeading("You're invited", 'Join an athletic<br />conference.'),
          ledeText(
            `<strong style="color:${B.nearBlack};">{{inviterOrgName}}</strong> invited your school to join the <strong style="color:${B.nearBlack};">{{conferenceName}}</strong> athletic conference on Lionheart.`
          ),
          ledeText(`As a member, your teams will share game schedules and scores with other conference schools automatically.`),
          centeredCta('View invitation', '{{invitationUrl}}'),
          microNote(`Only game schedules and team names are shared. Rosters, stats, and internal data stay private to your school.`),
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
  maintenance_repeat_repair: 'Repeat Repair Alert: {{assetName}}',
  maintenance_cost_threshold: 'Repair Cost Threshold Exceeded: {{assetName}}',
  maintenance_end_of_life: 'Asset End of Life: {{assetName}}',
  it_ticket_submitted: 'IT request {{ticketNumber}} received',
  it_ticket_assigned: 'IT ticket assigned: {{ticketNumber}}',
  it_ticket_in_progress: 'Work started on your IT request {{ticketNumber}}',
  it_ticket_on_hold: 'IT request {{ticketNumber}} is on hold',
  it_ticket_done: 'IT request {{ticketNumber}} resolved',
  it_ticket_urgent: 'URGENT IT request: {{ticketNumber}}',
  mfa_email_code: 'Your sign-in code: {{code}}',
  conference_invite: '{{inviterOrgName}} invited you to join {{conferenceName}}',
  conference_invite_existing: '{{inviterOrgName}} invited your school to join {{conferenceName}}',
}

const TEXT_BODIES: Record<EmailTemplate, string> = {
  welcome: 'Welcome to Lionheart! Your account at {{orgName}} is ready. Set your password: {{setupLink}}',
  email_verification: 'Hi {{firstName}}, welcome to {{orgName}}! Verify your email: {{verificationLink}} (expires in 24 hours).',
  password_setup: "You've been invited to join {{orgName}} on Lionheart. Set your password: {{setupLink}}",
  password_reset: 'Hi {{firstName}}, reset your password for {{orgName}} on Lionheart: {{resetLink}} (expires in 1 hour). If you did not request this, ignore this email.',
  event_updated: '"{{eventTitle}}" was rescheduled by {{updatedByName}}. New time: {{eventDate}}, {{eventTime}}. View: {{eventLink}}',
  event_approved: 'Your event "{{eventTitle}}" was approved via {{channelName}} channel. View: {{eventLink}}',
  event_rejected: 'Your event "{{eventTitle}}" was not approved. {{reason}} View: {{eventLink}}',
  event_cancelled: '"{{eventTitle}}" has been cancelled and removed from the calendar.',
  event_invite: 'You\'ve been added to "{{eventTitle}}". View: {{eventLink}}',
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
  maintenance_repeat_repair: 'Asset {{assetName}} ({{assetNumber}}) has had {{repairCount}} repairs in the last 12 months. View: {{assetUrl}}',
  maintenance_cost_threshold: 'Cumulative repair cost (${{cumulativeCost}}) for {{assetName}} has exceeded {{pct}}% of replacement cost (${{replacementCost}}). AI Recommendation: {{recommendation}}. View: {{assetUrl}}',
  maintenance_end_of_life: 'Asset {{assetName}} ({{assetNumber}}) purchased in {{purchaseYear}} has exceeded its expected lifespan of {{expectedLifespan}} years. View: {{assetUrl}}',
  it_ticket_submitted: 'Your IT request {{ticketNumber}} "{{ticketTitle}}" has been received. Category: {{category}}. View: {{ticketLink}}',
  it_ticket_assigned: 'IT ticket {{ticketNumber}} "{{ticketTitle}}" has been assigned to you. Priority: {{priority}}. View: {{ticketLink}}',
  it_ticket_in_progress: 'Work has started on your IT request {{ticketNumber}} "{{ticketTitle}}". View: {{ticketLink}}',
  it_ticket_on_hold: 'IT request {{ticketNumber}} "{{ticketTitle}}" is on hold. View: {{ticketLink}}',
  it_ticket_done: 'IT request {{ticketNumber}} "{{ticketTitle}}" has been resolved and closed. View: {{ticketLink}}',
  it_ticket_urgent: 'URGENT: IT request {{ticketNumber}} "{{ticketTitle}}" requires immediate attention. Category: {{category}}. View: {{ticketLink}}',
  mfa_email_code: 'Your Lionheart sign-in code is {{code}}. It expires in 5 minutes. If you did not request this, ignore this email.',
  conference_invite: '{{inviterOrgName}} invited {{schoolName}} to join the {{conferenceName}} athletic conference on Lionheart. Start your free 30-day trial: {{signupUrl}}',
  conference_invite_existing: '{{inviterOrgName}} invited your school to join the {{conferenceName}} athletic conference on Lionheart. View the invitation: {{invitationUrl}}',
}

/**
 * Render a Lionheart-branded email template.
 */
export function renderEmail(template: EmailTemplate, vars: TemplateVars): RenderEmailResult {
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
