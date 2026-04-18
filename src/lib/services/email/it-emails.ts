/** IT Help Desk ticket notification emails */

import { sendBrandedEmail, getAppUrl, type SendEmailResult } from './transport'

type ITEmailBase = { to: string; ticketNumber: string; ticketTitle: string; ticketLink: string }
type ITAssignedEmailInput = ITEmailBase & { priority: string; category: string }
type ITUrgentEmailInput = ITEmailBase & { category: string; location?: string }

export async function sendITTicketSubmittedEmail(input: ITEmailBase & { category: string }): Promise<SendEmailResult> {
  return sendBrandedEmail('it_ticket_submitted', input.to, { ticketNumber: input.ticketNumber, ticketTitle: input.ticketTitle, category: input.category, ticketLink: input.ticketLink, appUrl: getAppUrl() })
}

export async function sendITTicketAssignedEmail(input: ITAssignedEmailInput): Promise<SendEmailResult> {
  return sendBrandedEmail('it_ticket_assigned', input.to, { ticketNumber: input.ticketNumber, ticketTitle: input.ticketTitle, priority: input.priority, category: input.category, ticketLink: input.ticketLink, appUrl: getAppUrl() })
}

export async function sendITTicketInProgressEmail(input: ITEmailBase): Promise<SendEmailResult> {
  return sendBrandedEmail('it_ticket_in_progress', input.to, { ticketNumber: input.ticketNumber, ticketTitle: input.ticketTitle, ticketLink: input.ticketLink, appUrl: getAppUrl() })
}

export async function sendITTicketOnHoldEmail(input: ITEmailBase): Promise<SendEmailResult> {
  return sendBrandedEmail('it_ticket_on_hold', input.to, { ticketNumber: input.ticketNumber, ticketTitle: input.ticketTitle, ticketLink: input.ticketLink, appUrl: getAppUrl() })
}

export async function sendITTicketDoneEmail(input: ITEmailBase): Promise<SendEmailResult> {
  return sendBrandedEmail('it_ticket_done', input.to, { ticketNumber: input.ticketNumber, ticketTitle: input.ticketTitle, ticketLink: input.ticketLink, appUrl: getAppUrl() })
}

export async function sendITTicketUrgentEmail(input: ITUrgentEmailInput): Promise<SendEmailResult> {
  return sendBrandedEmail('it_ticket_urgent', input.to, { ticketNumber: input.ticketNumber, ticketTitle: input.ticketTitle, category: input.category, location: input.location, ticketLink: input.ticketLink, appUrl: getAppUrl() })
}
