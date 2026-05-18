/** Auth-related emails: verification, password reset, welcome/setup */

import { sendBrandedEmail, getAppUrl, type SendEmailResult } from './transport'
import type { EmailTemplate } from '@/lib/email/templates'

type VerificationEmailInput = {
  to: string
  firstName: string
  orgName: string
  verificationLink: string
}

type PasswordResetEmailInput = {
  to: string
  firstName: string
  orgName: string
  resetLink: string
}

type WelcomeEmailInput = {
  to: string
  firstName: string
  organizationName: string
  setupLink: string
  expiresAtIso: string
  mode: 'ADMIN_CREATE' | 'INVITE_ONLY'
}

export async function sendVerificationEmail(input: VerificationEmailInput): Promise<SendEmailResult> {
  return sendBrandedEmail('email_verification', input.to, {
    firstName: input.firstName,
    orgName: input.orgName,
    verificationLink: input.verificationLink,
    appUrl: getAppUrl(),
  })
}

export async function sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<SendEmailResult> {
  return sendBrandedEmail('password_reset', input.to, {
    firstName: input.firstName,
    orgName: input.orgName,
    resetLink: input.resetLink,
    appUrl: getAppUrl(),
  })
}

type MfaEmailCodeInput = {
  to: string
  code: string
}

export async function sendMfaEmailCode(input: MfaEmailCodeInput): Promise<SendEmailResult> {
  return sendBrandedEmail('mfa_email_code', input.to, {
    code: input.code,
  })
}

export async function sendWelcomeEmail(input: WelcomeEmailInput): Promise<SendEmailResult> {
  const expiresAt = new Date(input.expiresAtIso)
  const template: EmailTemplate = input.mode === 'ADMIN_CREATE' ? 'welcome' : 'password_setup'

  return sendBrandedEmail(template, input.to, {
    firstName: input.firstName,
    orgName: input.organizationName,
    setupLink: input.setupLink,
    expiresAt: expiresAt.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }),
    appUrl: getAppUrl(),
  })
}
