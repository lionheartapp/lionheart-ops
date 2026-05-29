import { test, expect } from '../fixtures'
import { userEmail } from '../helpers/data'

test.describe('Settings → Members', () => {
  test('admin can view the members list', async ({ adminPage }) => {
    await adminPage.goto('/settings')

    const membersTab = adminPage
      .getByRole('tab', { name: /members|users|team/i })
      .or(adminPage.getByRole('link', { name: /members|users/i }))
      .or(adminPage.getByRole('button', { name: /^members$/i }))
      .first()
    await membersTab.click()

    // The table should render at least one row (the admin themself).
    const membersTable = adminPage
      .getByRole('table')
      .or(adminPage.locator('[data-testid="members-table"],[data-testid="users-table"]'))
      .first()
    await expect(membersTable).toBeVisible({ timeout: 10_000 })
  })

  test('invite dialog opens and validates email', async ({ adminPage }) => {
    await adminPage.goto('/settings')
    await adminPage
      .getByRole('tab', { name: /members|users|team/i })
      .or(adminPage.getByRole('link', { name: /members|users/i }))
      .or(adminPage.getByRole('button', { name: /^members$/i }))
      .first()
      .click()

    const inviteBtn = adminPage.getByRole('button', { name: /invite|add member|new user/i }).first()
    await inviteBtn.click()

    // Dialog should appear with at least an email field.
    const dialog = adminPage.getByRole('dialog', { name: /invite/i }).first()
    const emailField = dialog.getByLabel(/email/i).first()
    await expect(emailField).toBeVisible({ timeout: 5_000 })

    // Bad email → validation error.
    await emailField.fill('not-an-email')
    const submit = dialog.getByRole('button', { name: /send|invite|submit/i }).first()
    await submit.click()
    await expect(emailField).toHaveJSProperty('validity.valid', false)

    // Good email (cancel rather than submit, to avoid sending a real invite).
    await emailField.fill(userEmail('invite-test'))
    const cancel = dialog.getByRole('button', { name: /cancel|close/i }).first()
    if (await cancel.isVisible().catch(() => false)) await cancel.click()
  })
})

test.describe('Settings → Members RBAC', () => {
  test('member-role user cannot see the invite button', async ({ memberPage }) => {
    await memberPage.goto('/settings')

    // Either the Members tab is missing entirely, or the invite button is hidden.
    const membersTab = memberPage
      .getByRole('tab', { name: /members|users/i })
      .or(memberPage.getByRole('link', { name: /members|users/i }))
      .or(memberPage.getByRole('button', { name: /^members$/i }))

    if (await membersTab.first().isVisible().catch(() => false)) {
      await membersTab.first().click()
      // Invite button should NOT be visible to a non-admin.
      await expect(memberPage.getByRole('button', { name: /invite|add member|new user/i }))
        .toHaveCount(0)
    }
  })
})
