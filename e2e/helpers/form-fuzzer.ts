import { Page, Locator, expect } from '@playwright/test'

/**
 * Form Fuzzer Helpers
 * ===================
 * Auto-discover and exercise forms on a page. Built for two use cases:
 *
 *   1. Smoke fuzzing — visit a page, click every "Add/Create/New" trigger,
 *      submit the resulting form empty, and verify the app doesn't crash and
 *      that *some* validation feedback shows up (or the form quietly does
 *      nothing). The goal is "no 500s, no white screens, no silent saves on
 *      empty input" — not asserting business outcomes.
 *
 *   2. Targeted fuzzing — fill a known form with a payload matrix
 *      (empty / max-length / unicode / XSS-ish strings) and confirm the
 *      server returns a clean 400 with a useful error code.
 */

// ----------------------------------------------------------------------------
// Payload library
// ----------------------------------------------------------------------------

export const FUZZ_PAYLOADS = {
  empty: '',
  whitespace: '   ',
  // Common long-string buster — most validation should cap at 255 or 1000.
  oversized: 'x'.repeat(5_000),
  unicode: '🚀🔥💥 — déjà vu — 你好 — مرحبا',
  // Looks like XSS but won't actually execute (React escapes); just confirms
  // the server doesn't 500 on angle brackets.
  htmlish: '<script>alert(1)</script><img src=x onerror=alert(1)>',
  // SQL-ish strings — Prisma is parameterized so this should just be saved
  // as a normal string. We're checking nothing crashes.
  sqlish: "'; DROP TABLE users; --",
  // Numbers / booleans inside string fields — cheap surprise.
  nullish: 'null',
  jsonish: '{"bad":"input"}',
} as const

export type FuzzPayloadName = keyof typeof FUZZ_PAYLOADS

// ----------------------------------------------------------------------------
// Triggers ("Add / Create / New / Invite ...") — these are the buttons most
// likely to open a modal or drawer with a form inside.
// ----------------------------------------------------------------------------

export const FORM_TRIGGER_REGEX =
  /\b(add|create|new|invite|upload|attach|import|insert)\b/i

export const FORM_DISMISS_REGEX = /\b(close|cancel|dismiss|×|x)\b/i

// ----------------------------------------------------------------------------
// Discovery
// ----------------------------------------------------------------------------

/**
 * Find buttons / links on the current page that look like form triggers.
 * Caller decides what to do with them — typically click each, exercise the
 * resulting form, then close the modal.
 */
export async function findFormTriggers(page: Page, max = 8): Promise<Locator[]> {
  const candidates = await page
    .getByRole('button')
    .filter({ hasText: FORM_TRIGGER_REGEX })
    .all()

  const linkCandidates = await page
    .getByRole('link')
    .filter({ hasText: FORM_TRIGGER_REGEX })
    .all()

  return [...candidates, ...linkCandidates].slice(0, max)
}

/**
 * Resolve the "active" form on the page — prefers a form inside a visible
 * modal/dialog, then any visible <form>, then the first form on the page.
 */
export async function findActiveForm(page: Page): Promise<Locator | null> {
  const dialogForm = page.locator('[role="dialog"] form, [role="alertdialog"] form').first()
  if (await dialogForm.isVisible().catch(() => false)) return dialogForm

  const visibleForm = page.locator('form:visible').first()
  if (await visibleForm.isVisible().catch(() => false)) return visibleForm

  const anyForm = page.locator('form').first()
  if (await anyForm.count()) return anyForm

  return null
}

// ----------------------------------------------------------------------------
// Submission helpers
// ----------------------------------------------------------------------------

/**
 * Click the form's submit button. Tries (in order): button[type=submit] inside
 * the form, the "primary" looking button by name, then any first button.
 */
export async function submitForm(form: Locator): Promise<boolean> {
  const submitBtn = form.locator('button[type="submit"]').first()
  if (await submitBtn.isVisible().catch(() => false)) {
    await submitBtn.click({ timeout: 5_000 }).catch(() => {})
    return true
  }
  const namedBtn = form
    .getByRole('button', { name: /save|submit|create|invite|send|continue|ok/i })
    .first()
  if (await namedBtn.isVisible().catch(() => false)) {
    await namedBtn.click({ timeout: 5_000 }).catch(() => {})
    return true
  }
  const fallback = form.getByRole('button').first()
  if (await fallback.isVisible().catch(() => false)) {
    await fallback.click({ timeout: 5_000 }).catch(() => {})
    return true
  }
  return false
}

/**
 * Try to dismiss whatever modal / drawer is open. Best-effort; never throws.
 */
export async function dismissOpenModal(page: Page): Promise<void> {
  const close = page.getByRole('button', { name: FORM_DISMISS_REGEX }).first()
  if (await close.isVisible().catch(() => false)) {
    await close.click({ timeout: 3_000 }).catch(() => {})
  }
  await page.keyboard.press('Escape').catch(() => {})
}

// ----------------------------------------------------------------------------
// Validation feedback detection
// ----------------------------------------------------------------------------

/**
 * After submitting an empty form, look for *any* of the patterns that
 * indicate validation feedback:
 *   - native :invalid pseudo on a required field
 *   - aria-invalid="true" anywhere
 *   - text matching common validation copy (required, must, invalid, ...)
 *   - role="alert" element appearing
 *
 * Returns true if we found a sign of validation, false if the form silently
 * accepted empty input.
 */
export async function hasValidationFeedback(form: Locator): Promise<boolean> {
  const page = form.page()

  // 1. Native :invalid on required fields inside the form.
  const invalidCount = await form.locator(':invalid').count().catch(() => 0)
  if (invalidCount > 0) return true

  // 2. aria-invalid="true" anywhere on the page (covers React-hook-form patterns).
  const ariaInvalid = await page.locator('[aria-invalid="true"]').count().catch(() => 0)
  if (ariaInvalid > 0) return true

  // 3. Visible text matching common validation copy.
  const errorTextRegex =
    /\b(required|must (be|have)|cannot be empty|please (enter|select|fill)|is invalid|too (short|long))\b/i
  const errorText = page.getByText(errorTextRegex).first()
  if (await errorText.isVisible().catch(() => false)) return true

  // 4. A role=alert appearing.
  const alert = page.getByRole('alert').first()
  if (await alert.isVisible().catch(() => false)) return true

  return false
}

// ----------------------------------------------------------------------------
// Targeted fuzz — fill known field names with a payload, then submit.
// ----------------------------------------------------------------------------

export interface FieldFill {
  /** Label / placeholder regex used to locate the field. */
  match: RegExp
  /** Optional override value; if missing we use the named payload. */
  value?: string
  /** Field type — text fields get .fill(), checkboxes get .check(), etc. */
  type?: 'text' | 'checkbox' | 'select'
}

export async function fillFields(
  form: Locator,
  fields: ReadonlyArray<FieldFill>,
  payloadName: FuzzPayloadName,
): Promise<void> {
  for (const f of fields) {
    const locator = form.getByLabel(f.match).first()
    if (!(await locator.count())) continue
    const value = f.value ?? FUZZ_PAYLOADS[payloadName]
    if (f.type === 'checkbox') {
      await locator.check().catch(() => {})
    } else if (f.type === 'select') {
      await locator.selectOption({ value }).catch(() => {})
    } else {
      await locator.fill(value).catch(() => {})
    }
  }
}

// ----------------------------------------------------------------------------
// One-shot helper used by the smoke fuzzer
// ----------------------------------------------------------------------------

export interface FormSmokeResult {
  triggersClicked: number
  formsExercised: number
  validationsFound: number
  silentSubmits: number
  pageErrors: string[]
}

/**
 * Visit the current page, click each form-trigger button it can find, and
 * exercise the resulting form by submitting it empty. Returns aggregate stats.
 *
 * Caller is responsible for navigating to the page first and asserting the
 * pageErrors length === 0 at the end (we don't throw — we collect).
 */
export async function runFormSmokeOnPage(
  page: Page,
  options: { maxTriggers?: number } = {},
): Promise<FormSmokeResult> {
  const result: FormSmokeResult = {
    triggersClicked: 0,
    formsExercised: 0,
    validationsFound: 0,
    silentSubmits: 0,
    pageErrors: [],
  }

  const errorListener = (e: Error) => result.pageErrors.push(e.message)
  page.on('pageerror', errorListener)

  try {
    const triggers = await findFormTriggers(page, options.maxTriggers ?? 6)
    for (const trigger of triggers) {
      if (!(await trigger.isVisible().catch(() => false))) continue
      if (!(await trigger.isEnabled().catch(() => false))) continue

      await trigger.click({ timeout: 5_000 }).catch(() => {})
      result.triggersClicked += 1

      // Wait briefly for the modal/drawer to render.
      await page.waitForTimeout(300)

      const form = await findActiveForm(page)
      if (!form) {
        await dismissOpenModal(page)
        continue
      }

      const submitted = await submitForm(form)
      if (submitted) {
        result.formsExercised += 1
        // Give the validation a moment to render / round-trip the server.
        await page.waitForTimeout(400)
        const showed = await hasValidationFeedback(form)
        if (showed) result.validationsFound += 1
        else result.silentSubmits += 1
      }
      await dismissOpenModal(page)
    }
  } finally {
    page.off('pageerror', errorListener)
  }

  return result
}

// ----------------------------------------------------------------------------
// Re-export helper for convenience in specs.
// ----------------------------------------------------------------------------
export { expect }
