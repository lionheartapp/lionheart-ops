import { test, expect } from '../fixtures'
import { ticketTitle } from '../helpers/data'

test.describe('Tickets', () => {
  test('admin can create and then see a ticket in the list', async ({ adminPage }) => {
    const title = ticketTitle()
    await adminPage.goto('/it')

    const newBtn = adminPage
      .getByRole('button', { name: /new ticket|create ticket|\+ ticket|add ticket/i })
      .or(adminPage.getByRole('link', { name: /new ticket|create ticket/i }))
      .first()
    await newBtn.click()

    // Fill the title / subject
    const titleField = adminPage.getByLabel(/title|subject|summary/i).first()
    await expect(titleField).toBeVisible({ timeout: 5_000 })
    await titleField.fill(title)

    // Description, if present
    const desc = adminPage.getByLabel(/description|details|notes/i).first()
    if (await desc.isVisible().catch(() => false)) {
      await desc.fill(`E2E-generated ticket for ${title}`)
    }

    // Priority / category — accept any default by just submitting if not shown.
    const submit = adminPage.getByRole('button', { name: /create|submit|save/i }).first()
    await submit.click()

    // Toast / redirect. Assert the new title appears somewhere.
    await expect(adminPage.getByText(title).first()).toBeVisible({ timeout: 10_000 })
  })

  test('ticket list loads without console errors', async ({ adminPage }) => {
    const errors: string[] = []
    adminPage.on('pageerror', (e) => errors.push(e.message))

    await adminPage.goto('/it')
    await expect(adminPage.getByRole('heading').first()).toBeVisible()
    expect(errors, errors.join('\n')).toHaveLength(0)
  })
})
