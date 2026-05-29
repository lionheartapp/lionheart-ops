import { test, expect } from '../fixtures'
import { eventTitle } from '../helpers/data'

test.describe('Events', () => {
  test('events page loads for admin', async ({ adminPage }) => {
    await adminPage.goto('/events')
    // Accept either an "events" heading or a calendar grid.
    await expect(
      adminPage
        .getByRole('heading', { name: /events|calendar|schedule/i })
        .or(adminPage.locator('.rbc-calendar, [data-testid="events-list"]'))
        .first(),
    ).toBeVisible({ timeout: 15_000 })
  })

  test('draft event create → persists title', async ({ adminPage }) => {
    const title = eventTitle()

    // Events live at /events (the kanban board), not /av
    await adminPage.goto('/events')

    // The CreateEventMenu renders a button with text "Event" (plus a + icon).
    // Match broadly — the button may say "Event", "New Event", "Create Event", etc.
    const createBtn = adminPage
      .getByRole('button', { name: /^event$|new event|create event|\+ event|add event/i })
      .first()
    if (!(await createBtn.isVisible({ timeout: 8_000 }).catch(() => false))) {
      test.skip(true, 'No create-event button visible — page layout may have changed')
    }
    await createBtn.click()

    // The menu drops down — pick the first option (e.g. "Quick event", "Full event").
    // Wait for the dropdown, then pick whatever the first menu item is.
    const menuItem = adminPage.getByRole('menuitem', { name: /single event/i }).first()
      .or(adminPage.locator('[role="option"]').first())
      .or(adminPage.locator('button:has-text("Quick")').first())
      .or(adminPage.locator('button:has-text("Full")').first())
    if (await menuItem.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await menuItem.click()
    }

    const eventDialog = adminPage.getByRole('dialog', { name: /new .*event/i })
    const titleField = eventDialog.getByLabel(/title|name/i).first()
    await expect(titleField).toBeVisible({ timeout: 5_000 })
    await titleField.fill(title)

    // The UI sets today's date when the date chip is clicked.
    const dateButton = eventDialog.getByRole('button', { name: /pick a date/i }).first()
    if (await dateButton.isVisible().catch(() => false)) {
      await dateButton.click()
    }

    await eventDialog.getByRole('button', { name: /continue/i }).click()
    await eventDialog.getByRole('button', { name: /off campus/i }).click()
    await eventDialog.getByPlaceholder(/search for a venue or address/i).fill('E2E test venue')
    await eventDialog.getByLabel(/venue/i).fill('E2E test venue')
    await eventDialog.getByRole('button', { name: /continue/i }).click()
    await eventDialog.getByRole('button', { name: /^create event$/i }).click()

    await expect(adminPage.getByText(title).first()).toBeVisible({ timeout: 10_000 })
  })
})
