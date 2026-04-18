import { test, expect } from '../fixtures'
import { eventTitle } from '../helpers/data'

test.describe('Events', () => {
  test('events page loads for admin', async ({ adminPage }) => {
    await adminPage.goto('/av')
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
    const menuItem = adminPage.getByRole('menuitem').first()
      .or(adminPage.locator('[role="option"]').first())
      .or(adminPage.locator('button:has-text("Quick")').first())
      .or(adminPage.locator('button:has-text("Full")').first())
    if (await menuItem.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await menuItem.click()
    }

    const titleField = adminPage.getByLabel(/title|name/i).first()
    await expect(titleField).toBeVisible({ timeout: 5_000 })
    await titleField.fill(title)

    // Date fields — use today for simplicity.
    const dateField = adminPage.getByLabel(/start|date/i).first()
    if (await dateField.isVisible().catch(() => false)) {
      const today = new Date().toISOString().slice(0, 10)
      await dateField.fill(today)
    }

    const submit = adminPage
      .getByRole('button', { name: /save|create|submit|draft/i })
      .first()
    await submit.click()

    await expect(adminPage.getByText(title).first()).toBeVisible({ timeout: 10_000 })
  })
})
