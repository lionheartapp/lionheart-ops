import { test, expect } from '../fixtures'
import { ticketTitle } from '../helpers/data'

test.describe('Tickets', () => {
  test('admin can create and then see a ticket in the list', async ({ adminPage }) => {
    const title = ticketTitle()
    await adminPage.goto('/it')

    const newBtn = adminPage
      .getByRole('button', { name: /new request|submit a request|new ticket|create ticket|\+ ticket|add ticket/i })
      .or(adminPage.getByRole('link', { name: /new ticket|create ticket/i }))
      .first()
    await newBtn.click()

    const manualForm = adminPage.getByRole('button', { name: /^manual form$/i }).first()
    await expect(manualForm).toBeVisible({ timeout: 10_000 })
    await manualForm.click()

    const requestDialog = adminPage.getByRole('dialog', { name: /new it request/i })
    await expect(requestDialog).toBeVisible({ timeout: 10_000 })

    // Fill the title / subject
    const titleField = requestDialog.getByLabel(/title|subject|summary/i).first()
    await expect(titleField).toBeVisible({ timeout: 5_000 })
    await titleField.fill(title)

    // Description, if present
    const desc = requestDialog.getByLabel(/description|details|notes/i).first()
    if (await desc.isVisible().catch(() => false)) {
      await desc.fill(`E2E-generated ticket for ${title}`)
    }

    const categorySelect = requestDialog.getByRole('button', { name: /select/i }).first()
    if (await categorySelect.isVisible().catch(() => false)) {
      await categorySelect.click()
      await requestDialog
        .getByRole('button', { name: /hardware|software|network|other/i })
        .first()
        .click()
    }

    const continueBtn = requestDialog.getByRole('button', { name: /continue/i }).first()
    if (await continueBtn.isVisible().catch(() => false)) {
      await continueBtn.click()
    }

    const submit = requestDialog.getByRole('button', { name: /submit request|create|submit|save/i }).first()
    await submit.click()

    await expect(requestDialog.getByText(/request submitted/i)).toBeVisible({ timeout: 10_000 })
    await requestDialog.getByRole('button', { name: /done/i }).click()

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
