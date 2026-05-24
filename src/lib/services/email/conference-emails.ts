/** Conference-related emails: external and existing-school invites. */

import { sendBrandedEmail, getAppUrl, type SendEmailResult } from './transport'

type ConferenceInviteEmailInput = {
  to: string
  conferenceName: string
  inviterOrgName: string
  schoolName: string
  signupUrl: string
  appUrl?: string
}

type ConferenceInviteExistingEmailInput = {
  to: string
  conferenceName: string
  inviterOrgName: string
  invitationUrl: string
  appUrl?: string
}

export async function sendConferenceInviteEmail(
  input: ConferenceInviteEmailInput
): Promise<SendEmailResult> {
  return sendBrandedEmail('conference_invite', input.to, {
    conferenceName: input.conferenceName,
    inviterOrgName: input.inviterOrgName,
    schoolName: input.schoolName,
    signupUrl: input.signupUrl,
    appUrl: input.appUrl || getAppUrl(),
  })
}

export async function sendConferenceInviteExistingEmail(
  input: ConferenceInviteExistingEmailInput
): Promise<SendEmailResult> {
  return sendBrandedEmail('conference_invite_existing', input.to, {
    conferenceName: input.conferenceName,
    inviterOrgName: input.inviterOrgName,
    invitationUrl: input.invitationUrl,
    appUrl: input.appUrl || getAppUrl(),
  })
}
