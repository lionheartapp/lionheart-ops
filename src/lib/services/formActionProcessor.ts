/**
 * Form Action Processor
 *
 * After a form submission is created, this runs each enabled FormAction
 * in order: notify, require approval, webhook, redirect.
 *
 * Called fire-and-forget from the submission endpoints.
 */

import { rawPrisma } from '@/lib/db'
import type { FormActionType } from '@prisma/client'
import { logger } from '@/lib/logger'

const log = logger.child({ module: 'formActionProcessor' })

interface ActionConfig {
  // NOTIFY
  emails?: string[]
  teamIds?: string[]
  notifySubmitter?: boolean
  subject?: string
  message?: string
  // REQUIRE_APPROVAL
  approverEmails?: string[]
  approverTeamIds?: string[]
  // WEBHOOK
  url?: string
  headers?: Record<string, string>
  // REDIRECT
  redirectUrl?: string
}

interface SubmissionContext {
  submissionId: string
  formId: string
  formName: string | null
  orgId: string
  submitterEmail: string | null
  submitterName: string | null
  data: Record<string, unknown>
}

/**
 * Process all enabled actions for a form after submission.
 * Runs fire-and-forget — errors are logged but don't fail the submission.
 */
export async function processFormActions(ctx: SubmissionContext): Promise<void> {
  try {
    const actions = await rawPrisma.formAction.findMany({
      where: { formId: ctx.formId, isEnabled: true },
      orderBy: { sortOrder: 'asc' },
    })

    if (actions.length === 0) return

    for (const action of actions) {
      try {
        const config = (action.config ?? {}) as ActionConfig
        await processAction(action.actionType, config, ctx)
      } catch (err) {
        log.error({ err, actionId: action.id, actionType: action.actionType }, 'Form action failed')
      }
    }
  } catch (err) {
    log.error({ err, formId: ctx.formId }, 'Failed to load form actions')
  }
}

async function processAction(
  type: FormActionType,
  config: ActionConfig,
  ctx: SubmissionContext
): Promise<void> {
  switch (type) {
    case 'NOTIFY':
      await handleNotify(config, ctx)
      break
    case 'REQUIRE_APPROVAL':
      await handleRequireApproval(config, ctx)
      break
    case 'WEBHOOK':
      await handleWebhook(config, ctx)
      break
    case 'REDIRECT':
      // Redirect is handled client-side — store the URL on the submission
      if (config.redirectUrl) {
        await rawPrisma.formSubmission.update({
          where: { id: ctx.submissionId },
          data: {
            data: {
              ...(ctx.data ?? {}),
              __redirectUrl: config.redirectUrl,
            },
          },
        })
      }
      break
    case 'CREATE_RECORD':
      // CREATE_RECORD is handled by the specific feature module (events, tickets)
      // that owns the form context — not here.
      break
  }
}

// ─── Action Handlers ────────────────────────────────────────────────────────

async function handleNotify(config: ActionConfig, ctx: SubmissionContext): Promise<void> {
  const recipients: string[] = []

  // Direct emails
  if (config.emails?.length) {
    recipients.push(...config.emails)
  }

  // Team members — resolve team IDs to email addresses
  if (config.teamIds?.length) {
    const teamMembers = await rawPrisma.userTeam.findMany({
      where: { teamId: { in: config.teamIds } },
      select: {
        user: { select: { email: true } },
      },
    })
    for (const tm of teamMembers) {
      if (tm.user.email && !recipients.includes(tm.user.email)) {
        recipients.push(tm.user.email)
      }
    }
  }

  // Notify submitter
  if (config.notifySubmitter && ctx.submitterEmail) {
    if (!recipients.includes(ctx.submitterEmail)) {
      recipients.push(ctx.submitterEmail)
    }
  }

  if (recipients.length === 0) return

  // Create in-app notifications for org users
  const orgUsers = await rawPrisma.user.findMany({
    where: {
      organizationId: ctx.orgId,
      email: { in: recipients },
      deletedAt: null,
    },
    select: { id: true },
  })

  if (orgUsers.length > 0) {
    await rawPrisma.notification.createMany({
      data: orgUsers.map((u) => ({
        organizationId: ctx.orgId,
        userId: u.id,
        type: 'FORM_SUBMISSION',
        title: config.subject || `New form submission: ${ctx.formName || 'Form'}`,
        message: config.message || `${ctx.submitterName || 'Someone'} submitted a response.`,
        metadata: {
          formId: ctx.formId,
          submissionId: ctx.submissionId,
        },
      })),
    })
  }

  // Email notifications would go through the email service here.
  // For now, in-app notifications cover the use case.
  log.info({ formId: ctx.formId, recipientCount: recipients.length }, 'Form submission notifications sent')
}

async function handleRequireApproval(config: ActionConfig, ctx: SubmissionContext): Promise<void> {
  // Transition the submission to PENDING_APPROVAL
  await rawPrisma.formSubmission.update({
    where: { id: ctx.submissionId },
    data: { status: 'PENDING_APPROVAL' },
  })

  // Notify approvers
  const approverEmails = config.approverEmails ?? []

  if (config.approverTeamIds?.length) {
    const teamMembers = await rawPrisma.userTeam.findMany({
      where: { teamId: { in: config.approverTeamIds } },
      select: { user: { select: { email: true } } },
    })
    for (const tm of teamMembers) {
      if (tm.user.email && !approverEmails.includes(tm.user.email)) {
        approverEmails.push(tm.user.email)
      }
    }
  }

  if (approverEmails.length > 0) {
    const approverUsers = await rawPrisma.user.findMany({
      where: {
        organizationId: ctx.orgId,
        email: { in: approverEmails },
        deletedAt: null,
      },
      select: { id: true },
    })

    if (approverUsers.length > 0) {
      await rawPrisma.notification.createMany({
        data: approverUsers.map((u) => ({
          organizationId: ctx.orgId,
          userId: u.id,
          type: 'FORM_APPROVAL_NEEDED',
          title: `Approval needed: ${ctx.formName || 'Form submission'}`,
          message: `${ctx.submitterName || 'A user'} submitted a response that needs your review.`,
          metadata: {
            formId: ctx.formId,
            submissionId: ctx.submissionId,
          },
        })),
      })
    }
  }

  log.info({ formId: ctx.formId, submissionId: ctx.submissionId }, 'Submission requires approval')
}

async function handleWebhook(config: ActionConfig, ctx: SubmissionContext): Promise<void> {
  if (!config.url) return

  const payload = {
    event: 'form.submission.created',
    formId: ctx.formId,
    submissionId: ctx.submissionId,
    submitterEmail: ctx.submitterEmail,
    submitterName: ctx.submitterName,
    data: ctx.data,
    timestamp: new Date().toISOString(),
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(config.headers ?? {}),
  }

  const res = await fetch(config.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000), // 10s timeout
  })

  log.info(
    { formId: ctx.formId, webhookUrl: config.url, status: res.status },
    'Webhook delivered'
  )
}
