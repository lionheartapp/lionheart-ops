/**
 * Calendar User Test — Comprehensive automated UX audit
 * Tests all 12 flows requested for the calendar module
 */

import pkg from '/Users/mkerley/.nvm/versions/node/v22.20.0/lib/node_modules/@playwright/mcp/node_modules/playwright/index.js';
const { chromium } = pkg;
import { mkdirSync } from 'fs';
import { join } from 'path';

const TENANT_SUBDOMAIN = 'linfield-christian-school';
const BASE_URL = `https://${TENANT_SUBDOMAIN}.lionheartapp.com`;
const EMAIL = 'mkerley@linfield.com';
const PASSWORD = 'TestPass123!';
const SCREENSHOTS_DIR = '/Users/mkerley/Desktop/Linfield Test/scripts/calendar-test-screenshots';

mkdirSync(SCREENSHOTS_DIR, { recursive: true });

let screenshotIndex = 0;
const issues = [];
const findings = [];
const notes = [];

function log(msg) {
  console.log(`  ${msg}`);
}

function logIssue(severity, title, detail) {
  const issue = { severity, title, detail };
  issues.push(issue);
  const prefix = severity === 'CRITICAL' ? '🔴' : severity === 'MAJOR' ? '🟠' : '🟡';
  console.log(`  ${prefix} [${severity}] ${title}: ${detail}`);
}

function logFinding(title, detail) {
  findings.push({ title, detail });
  console.log(`  ✅ ${title}: ${detail}`);
}

function logNote(msg) {
  notes.push(msg);
  console.log(`  📝 NOTE: ${msg}`);
}

async function screenshot(page, label) {
  screenshotIndex++;
  const filename = `${String(screenshotIndex).padStart(2, '0')}-${label.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`;
  const path = join(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path, fullPage: false });
  log(`[screenshot] ${filename}`);
  return path;
}

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Helper: try multiple selectors, return first visible
async function findVisible(page, selectors) {
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    if (await el.count() > 0) {
      try {
        const visible = await el.isVisible();
        if (visible) return el;
      } catch (e) {}
    }
  }
  return null;
}

async function main() {
  console.log('');
  console.log('=== CALENDAR MODULE USER TEST ===');
  console.log(`URL: ${BASE_URL}`);
  console.log(`Date: ${new Date().toISOString()}`);
  console.log('');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 50,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  // ─── FLOW 1: Login ──────────────────────────────────────────────────────────
  console.log('FLOW 1: Login via tenant subdomain');
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await wait(1500);
  await screenshot(page, 'login-page');

  log(`Login page URL: ${page.url()}`);

  // Try to detect login form
  const allInputs = await page.locator('input').all();
  log(`Found ${allInputs.length} input elements on login page`);

  for (const input of allInputs) {
    const type = await input.getAttribute('type');
    const name = await input.getAttribute('name');
    const placeholder = await input.getAttribute('placeholder');
    log(`  input: type="${type}" name="${name}" placeholder="${placeholder}"`);
  }

  // Fill email
  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i], input[autocomplete="email"]').first();
  const pwInput = page.locator('input[type="password"]').first();

  if (await emailInput.count() === 0) {
    logIssue('CRITICAL', 'Login form missing email field', `No email input found on ${page.url()}`);
    // Try filling whatever inputs exist
    if (allInputs.length >= 2) {
      await allInputs[0].fill(EMAIL);
      await allInputs[1].fill(PASSWORD);
    } else if (allInputs.length === 1) {
      await allInputs[0].fill(EMAIL);
    }
  } else {
    await emailInput.fill(EMAIL);
    logFinding('Login email field', 'Found and filled email field');
  }

  if (await pwInput.count() === 0) {
    logIssue('MAJOR', 'Login password field missing', 'No password input found on login page');
  } else {
    await pwInput.fill(PASSWORD);
    logFinding('Login password field', 'Found and filled password field');
  }

  await screenshot(page, 'login-filled');

  // Submit
  const submitBtn = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Login"), button:has-text("Log in"), input[type="submit"]').first();
  if (await submitBtn.count() > 0) {
    await submitBtn.click();
  } else {
    await page.keyboard.press('Enter');
  }

  await page.waitForLoadState('networkidle');
  await wait(2500);
  await screenshot(page, 'post-login');

  const postLoginUrl = page.url();
  log(`Post-login URL: ${postLoginUrl}`);

  if (postLoginUrl.includes('/login')) {
    // Check for error message
    const errorMsg = await page.locator('[class*="error"], [role="alert"], .text-red, [class*="alert"]').first();
    if (await errorMsg.count() > 0) {
      const errText = await errorMsg.innerText();
      logIssue('CRITICAL', 'Login failed with error', `Login error message: "${errText.trim()}"`);
    } else {
      logIssue('CRITICAL', 'Login failed silently', 'Redirected back to /login with no visible error message after submitting valid credentials');
    }
    await browser.close();
    printReport();
    return;
  } else {
    logFinding('Login', `Successful — navigated to ${postLoginUrl}`);
  }

  // ─── FLOW 2: Navigate to Calendar from Sidebar ───────────────────────────
  console.log('');
  console.log('FLOW 2: Navigate to Calendar from sidebar');

  await screenshot(page, 'post-login-dashboard');

  // Find sidebar links
  const allSidebarLinks = await page.locator('nav a, aside a, [role="navigation"] a').all();
  log(`Found ${allSidebarLinks.length} sidebar/nav links`);

  for (const link of allSidebarLinks) {
    try {
      const text = await link.innerText();
      const href = await link.getAttribute('href');
      if (text.trim()) log(`  link: "${text.trim()}" → ${href}`);
    } catch (e) {}
  }

  // Try to find and click the calendar link
  const calendarLink = await findVisible(page, [
    'a[href*="calendar"]',
    'a[href*="/calendar"]',
    'nav a:has-text("Calendar")',
    'aside a:has-text("Calendar")',
    '[data-testid*="calendar"]',
    'a:has-text("Calendar")',
  ]);

  if (!calendarLink) {
    logIssue('MAJOR', 'No Calendar sidebar link', 'Could not find a visible Calendar link in the navigation');
    // Try direct navigation
    await page.goto(`${BASE_URL}/calendar`);
    await page.waitForLoadState('networkidle');
    await wait(2000);
  } else {
    logFinding('Calendar sidebar link', 'Found Calendar link in navigation');
    await calendarLink.click();
    await page.waitForLoadState('networkidle');
    await wait(2000);
  }

  await screenshot(page, 'calendar-page');
  const calendarUrl = page.url();
  log(`Calendar URL: ${calendarUrl}`);

  if (!calendarUrl.includes('calendar')) {
    logIssue('MAJOR', 'Calendar navigation failed', `URL is ${calendarUrl} — calendar not loaded`);
  } else {
    logFinding('Calendar page loaded', `Navigated to ${calendarUrl}`);
  }

  // ─── FLOW 3: Sidebar Calendar Sections (MASTER / MY SCHEDULE) ─────────────
  console.log('');
  console.log('FLOW 3: Check sidebar for MASTER / MY SCHEDULE sections');

  // Get all text content from left panel/sidebar
  const sidebarText = await page.locator('aside, [class*="sidebar"], nav').first().innerText().catch(() => '');
  log(`Sidebar text: ${sidebarText.substring(0, 300)}`);

  const hasMaster = sidebarText.toUpperCase().includes('MASTER');
  const hasMySchedule = sidebarText.toUpperCase().includes('MY SCHEDULE') || sidebarText.toUpperCase().includes('MY CALENDARS');

  if (!hasMaster) {
    logIssue('MAJOR', 'MASTER section missing', 'No "MASTER" section heading found in calendar sidebar');
  } else {
    logFinding('MASTER section', '"MASTER" section heading found in sidebar');
  }

  if (!hasMySchedule) {
    logIssue('MAJOR', 'MY SCHEDULE section missing', 'No "MY SCHEDULE" or "MY CALENDARS" section found in sidebar');
  } else {
    logFinding('MY SCHEDULE section', '"MY SCHEDULE" section found in sidebar');
  }

  await screenshot(page, 'sidebar-sections');

  // ─── FLOW 4: Toggle Calendar Visibility ──────────────────────────────────
  console.log('');
  console.log('FLOW 4: Toggle calendar visibility on/off');

  // Look for any toggle controls in the calendar sidebar area
  // The calendar sidebar usually has a left panel separate from main nav
  const calSidebar = page.locator('[class*="calendar-sidebar"], [class*="cal-sidebar"], aside').last();

  // Check for colored dots / checkboxes / eye icons
  const checkboxes = page.locator('input[type="checkbox"]');
  const checkboxCount = await checkboxes.count();
  log(`Total checkboxes on page: ${checkboxCount}`);

  // Look for list items in the calendar sidebar that represent calendar groups
  const calListItems = page.locator('li, [class*="calendar-group"], [class*="cal-item"]');
  const listItemCount = await calListItems.count();
  log(`Calendar list items found: ${listItemCount}`);

  // Try hover to reveal hidden menus/toggles
  if (listItemCount > 0) {
    const firstItem = calListItems.first();
    const itemText = await firstItem.innerText().catch(() => '');
    log(`First list item text: "${itemText.substring(0, 50)}"`);
    await firstItem.hover();
    await wait(500);
    await screenshot(page, 'calendar-item-hover');
  }

  // Check if there are eye icon buttons
  const eyeButtons = page.locator('[aria-label*="hide" i], [aria-label*="show" i], [aria-label*="visible" i], [aria-label*="toggle" i]');
  const eyeCount = await eyeButtons.count();
  log(`Eye/toggle buttons: ${eyeCount}`);

  if (checkboxCount === 0 && eyeCount === 0) {
    logIssue('MAJOR', 'No visible calendar toggle controls', 'Cannot find checkboxes, eye icons, or toggle buttons to control calendar visibility');
  }

  // ─── FLOW 5: Toggle ALL Calendars Off ─────────────────────────────────────
  console.log('');
  console.log('FLOW 5: Toggle ALL calendars off — check if events still show');

  // Count events before
  const eventSelectorsToCheck = [
    '[class*="event"]',
    '[class*="fc-event"]',
    '.fc-event',
    '[data-testid*="event"]',
    '[class*="EventPill"]',
    '[class*="event-pill"]',
    '[class*="event-item"]',
    '[class*="CalendarEvent"]',
  ];

  let eventsBefore = 0;
  let eventSelectorUsed = '';
  for (const sel of eventSelectorsToCheck) {
    const count = await page.locator(sel).count();
    if (count > 0) {
      eventsBefore = count;
      eventSelectorUsed = sel;
      log(`Events found with selector "${sel}": ${count}`);
      break;
    }
  }

  if (eventsBefore === 0) {
    logNote('No events found on the calendar to test the all-off toggle. The filter test is inconclusive — try with a date range that has events.');
  }

  await screenshot(page, 'before-toggle-all-off');

  // Try to find and click all checkboxes to turn them off
  const allCheckboxes = await page.locator('input[type="checkbox"]').all();
  let toggledOffCount = 0;
  for (const cb of allCheckboxes) {
    try {
      const checked = await cb.isChecked();
      if (checked) {
        await cb.click();
        await wait(200);
        toggledOffCount++;
      }
    } catch (e) {}
  }

  log(`Toggled off ${toggledOffCount} checkboxes`);

  if (toggledOffCount > 0) {
    await wait(800);
    const eventsAfter = eventSelectorUsed ? await page.locator(eventSelectorUsed).count() : 0;
    log(`Events after toggling all off: ${eventsAfter} (was ${eventsBefore})`);
    await screenshot(page, 'after-toggle-all-off');

    if (eventsAfter > 0 && eventsBefore > 0) {
      logIssue('CRITICAL', 'Events persist when all calendars disabled', `${eventsAfter} event(s) still visible after turning off all ${toggledOffCount} calendar checkboxes. Calendar filtering is broken.`);
    } else if (eventsAfter > 0 && eventsBefore === 0) {
      logNote('Events appeared after toggling — possibly a display glitch or the events were in a hidden area before');
    } else if (toggledOffCount > 0) {
      logFinding('All-calendars-off filter', `Events correctly hidden (${eventsBefore} → ${eventsAfter}) when all calendars disabled`);
    }

    // Re-enable all
    const allCbs2 = await page.locator('input[type="checkbox"]').all();
    for (const cb of allCbs2) {
      try {
        const checked = await cb.isChecked();
        if (!checked) {
          await cb.click();
          await wait(150);
        }
      } catch (e) {}
    }
    await wait(600);
  } else {
    logNote('No checkboxes found to toggle — all-off test skipped');
  }

  // ─── FLOW 6: Click on a date to create an event ───────────────────────────
  console.log('');
  console.log('FLOW 6: Click on a date to create an event');

  await screenshot(page, 'calendar-before-date-click');

  // Log all clickable elements in the calendar main area
  const mainArea = page.locator('main, [class*="calendar-main"], [class*="cal-body"], [class*="CalendarView"]').first();
  const mainAreaExists = await mainArea.count() > 0;
  log(`Main calendar area found: ${mainAreaExists}`);

  // Try clicking an empty day cell
  const dayCellSelectors = [
    '.fc-daygrid-day-frame',
    '.fc-daygrid-day',
    'td[data-date]',
    '[class*="DayCell"]',
    '[class*="day-cell"]',
    '[class*="day-number"]',
    '[class*="CalDay"]',
  ];

  let clickedCell = false;
  for (const sel of dayCellSelectors) {
    const cells = page.locator(sel);
    const count = await cells.count();
    if (count > 0) {
      log(`Found ${count} day cells with selector "${sel}"`);
      // Click the middle cell (less likely to have events)
      const targetIdx = Math.min(Math.floor(count / 2) + 3, count - 1);
      const cell = cells.nth(targetIdx);
      await cell.click();
      await wait(1200);
      clickedCell = true;
      log(`Clicked day cell ${targetIdx} of ${count}`);
      break;
    }
  }

  if (!clickedCell) {
    // Try clicking somewhere in the main content area
    const box = await mainArea.boundingBox().catch(() => null);
    if (box) {
      await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.4);
      await wait(1200);
      clickedCell = true;
      log('Clicked in main area at 40% position');
    } else {
      logIssue('MAJOR', 'Cannot find calendar day cells', 'No clickable day cells found in calendar');
    }
  }

  await screenshot(page, 'after-date-click');

  // Check for any panel/modal/drawer appearing
  const panelSelectors = [
    '[role="dialog"]',
    '[class*="modal"]',
    '[class*="Modal"]',
    '[class*="drawer"]',
    '[class*="Drawer"]',
    '[class*="panel"]',
    '[class*="Panel"]',
    '[class*="create-event"]',
    '[class*="CreateEvent"]',
    '[class*="EventForm"]',
    '[class*="event-form"]',
    '[class*="SlideOver"]',
    '[class*="side-panel"]',
  ];

  let createPanelFound = false;
  for (const sel of panelSelectors) {
    const el = page.locator(sel).first();
    if (await el.count() > 0 && await el.isVisible()) {
      const panelText = await el.innerText().catch(() => '');
      log(`Create panel found with selector "${sel}": "${panelText.substring(0, 100)}"`);
      createPanelFound = true;
      logFinding('Date click → create panel', `Panel appeared after clicking date (selector: ${sel})`);
      break;
    }
  }

  if (clickedCell && !createPanelFound) {
    logIssue('MAJOR', 'Date click does not open create panel', 'Clicking on a calendar date cell did not trigger any event creation modal, drawer, or panel');
  }

  // ─── FLOW 7: Event Create Panel — All Form Fields ─────────────────────────
  console.log('');
  console.log('FLOW 7: Inspect event create panel form fields');

  // Collect all visible inputs on screen right now
  const allVisibleInputs = await page.locator('input:visible, textarea:visible, select:visible').all();
  log(`Visible inputs in create panel: ${allVisibleInputs.length}`);

  for (const inp of allVisibleInputs) {
    const type = await inp.getAttribute('type').catch(() => '?');
    const name = await inp.getAttribute('name').catch(() => '');
    const placeholder = await inp.getAttribute('placeholder').catch(() => '');
    const id = await inp.getAttribute('id').catch(() => '');
    const ariaLabel = await inp.getAttribute('aria-label').catch(() => '');
    log(`  input: type="${type}" name="${name}" id="${id}" placeholder="${placeholder}" aria-label="${ariaLabel}"`);
  }

  // Check for title field specifically
  const titleField = page.locator('input[placeholder*="title" i], input[placeholder*="event name" i], input[name="title"], input[placeholder*="name" i], input[aria-label*="title" i]').first();
  if (await titleField.count() > 0 && await titleField.isVisible()) {
    logFinding('Event create: title field', 'Title input found and visible');
    await titleField.fill('Test Event - UX Audit');
  } else if (createPanelFound) {
    logIssue('MAJOR', 'Event create: title field missing', 'Create panel is open but no title/name input found');
  }

  // Check for date/time pickers
  const dateFields = page.locator('input[type="date"], input[type="datetime-local"], [class*="DatePicker"], [class*="date-picker"], [class*="TimePicker"]');
  const dateFieldCount = await dateFields.count();
  if (dateFieldCount > 0) {
    logFinding('Event create: date/time field', `Found ${dateFieldCount} date/time field(s)`);
  } else if (createPanelFound) {
    logIssue('MAJOR', 'Event create: date/time field missing', 'No date or time picker found in create panel');
  }

  // Check for description/notes
  const descField = page.locator('textarea, input[placeholder*="description" i], input[placeholder*="notes" i], input[name="description"]').first();
  if (await descField.count() > 0 && await descField.isVisible()) {
    logFinding('Event create: description field', 'Description textarea/input found');
  } else if (createPanelFound) {
    logIssue('MINOR', 'Event create: description field missing', 'No description or notes field visible in create panel');
  }

  // Check for location
  const locationField = page.locator('input[placeholder*="location" i], input[name="location"], input[aria-label*="location" i]').first();
  if (await locationField.count() > 0 && await locationField.isVisible()) {
    logFinding('Event create: location field', 'Location input found');
  } else if (createPanelFound) {
    logIssue('MINOR', 'Event create: location field missing', 'No location input visible in create panel');
  }

  await screenshot(page, 'create-event-panel');

  // Close the create panel
  await page.keyboard.press('Escape');
  await wait(800);

  // ─── FLOW 8: View Switching (Month/Week/Day/Agenda) ──────────────────────
  console.log('');
  console.log('FLOW 8: Switch between Month/Week/Day/Agenda views');

  await screenshot(page, 'before-view-switch');

  const viewNames = ['Month', 'Week', 'Day', 'Agenda'];

  for (const viewName of viewNames) {
    const viewBtn = await findVisible(page, [
      `button:has-text("${viewName}")`,
      `[aria-label*="${viewName}" i]`,
      `[data-view="${viewName.toLowerCase()}"]`,
      `[role="tab"]:has-text("${viewName}")`,
      `a:has-text("${viewName}")`,
    ]);

    if (!viewBtn) {
      logIssue('MAJOR', `${viewName} view button missing`, `No visible button to switch to ${viewName} view`);
    } else {
      logFinding(`${viewName} view button`, `Found ${viewName} view toggle`);
      await viewBtn.click();
      await wait(1000);
      await screenshot(page, `view-${viewName.toLowerCase()}`);

      // Verify view changed — check for any calendar content
      const calContent = page.locator('.fc, [class*="calendar-view"], [class*="CalView"], [class*="WeekView"], [class*="MonthView"], [class*="DayView"], [class*="AgendaView"]').first();
      if (await calContent.count() > 0) {
        logFinding(`${viewName} view content`, `Calendar content present in ${viewName} view`);
      } else {
        logIssue('MAJOR', `${viewName} view appears empty`, `After switching to ${viewName}, no calendar content element found`);
      }
    }
  }

  // Switch back to Week view for subsequent tests
  const weekBtn = await findVisible(page, ['button:has-text("Week")', '[data-view="week"]']);
  if (weekBtn) {
    await weekBtn.click();
    await wait(1000);
  }

  // ─── FLOW 9: Click on existing event for detail panel ────────────────────
  console.log('');
  console.log('FLOW 9: Click on existing event to see detail panel');

  // Switch to Month view to see more events
  const monthBtnForEvents = await findVisible(page, ['button:has-text("Month")', '[data-view="month"]']);
  if (monthBtnForEvents) {
    await monthBtnForEvents.click();
    await wait(1000);
  }

  await screenshot(page, 'looking-for-events');

  // Find events
  const allEventSelectors = [
    '.fc-event',
    '[class*="EventPill"]',
    '[class*="event-pill"]',
    '[class*="event-chip"]',
    '[class*="EventChip"]',
    '[class*="CalendarEvent"]',
    '[class*="calendar-event"]',
    '[class*="event-item"]',
    '[class*="EventItem"]',
  ];

  let existingEvent = null;
  let foundEventSelector = '';
  for (const sel of allEventSelectors) {
    const count = await page.locator(sel).count();
    if (count > 0) {
      existingEvent = page.locator(sel).first();
      foundEventSelector = sel;
      log(`Found ${count} events with selector "${sel}"`);
      break;
    }
  }

  if (!existingEvent) {
    logIssue('MAJOR', 'No events found to click', 'Cannot find any event elements in the calendar to test detail panel. Calendar may be empty or event elements use unknown class names.');
  } else {
    await existingEvent.click();
    await wait(1200);
    await screenshot(page, 'event-detail-panel');

    let detailFound = false;
    for (const sel of panelSelectors) {
      const el = page.locator(sel).first();
      if (await el.count() > 0 && await el.isVisible()) {
        const panelText = await el.innerText().catch(() => '');
        log(`Detail panel found (${sel}): "${panelText.substring(0, 150)}"`);
        logFinding('Event click → detail panel', `Detail panel opened when clicking event`);
        detailFound = true;

        // Check detail panel has useful content
        if (panelText.length < 10) {
          logIssue('MINOR', 'Event detail panel has little content', 'Detail panel opened but appears near-empty');
        }

        // Look for action buttons (edit, delete)
        const editBtn = page.locator('[aria-label*="edit" i], button:has-text("Edit")').first();
        const deleteBtn = page.locator('[aria-label*="delete" i], button:has-text("Delete")').first();
        const hasEdit = await editBtn.count() > 0 && await editBtn.isVisible();
        const hasDelete = await deleteBtn.count() > 0 && await deleteBtn.isVisible();

        if (!hasEdit) logIssue('MINOR', 'Event detail: no Edit button', 'Detail panel does not show an Edit button');
        else logFinding('Event detail: Edit button', 'Edit action found in detail panel');

        if (!hasDelete) logIssue('MINOR', 'Event detail: no Delete button', 'Detail panel does not show a Delete button');
        else logFinding('Event detail: Delete button', 'Delete action found in detail panel');

        break;
      }
    }

    if (!detailFound) {
      logIssue('MAJOR', 'Event click: no detail panel appeared', 'Clicked on an event but no modal/drawer/panel appeared');
    }

    // Close detail panel
    await page.keyboard.press('Escape');
    await wait(500);
  }

  // ─── FLOW 10: Three-dot menu on calendar sidebar item ────────────────────
  console.log('');
  console.log('FLOW 10: Three-dot menu on calendar sidebar item (rename, change color)');

  // Get all elements in the left sidebar area
  const calSidebarArea = page.locator('[class*="CalendarSidebar"], [class*="calendar-sidebar"], aside, [class*="left-panel"], [class*="LeftPanel"]').first();
  const sidebarExists = await calSidebarArea.count() > 0;
  log(`Calendar sidebar element found: ${sidebarExists}`);

  if (sidebarExists) {
    const sidebarButtons = await calSidebarArea.locator('button').all();
    log(`Sidebar buttons: ${sidebarButtons.length}`);
    for (const btn of sidebarButtons) {
      const txt = await btn.innerText().catch(() => '');
      const ariaLabel = await btn.getAttribute('aria-label').catch(() => '');
      if (txt.trim() || ariaLabel) log(`  sidebar button: "${txt.trim()}" [${ariaLabel}]`);
    }
  }

  // Find sidebar list items and hover
  const sidebarListItems = page.locator('[class*="CalendarSidebar"] li, [class*="calendar-sidebar"] li, aside li, [class*="CalGroup"] li, [class*="CalendarItem"]');
  const sidebarListCount = await sidebarListItems.count();
  log(`Sidebar list items: ${sidebarListCount}`);

  if (sidebarListCount > 0) {
    const firstItem = sidebarListItems.first();
    const itemText = await firstItem.innerText().catch(() => '');
    log(`First sidebar list item: "${itemText.substring(0, 80)}"`);

    await firstItem.hover();
    await wait(600);
    await screenshot(page, 'sidebar-item-hover');

    // Look for three-dot / ellipsis / context menu button that may appear on hover
    const contextMenuBtn = await findVisible(page, [
      'button[aria-label*="more" i]',
      'button[aria-label*="options" i]',
      'button[aria-label*="menu" i]',
      '[class*="MoreButton"]',
      '[class*="more-button"]',
      '[class*="ellipsis"]',
      '[class*="three-dot"]',
      '[class*="context-menu-trigger"]',
      'button svg',  // icon-only buttons
    ]);

    if (contextMenuBtn) {
      await contextMenuBtn.click();
      await wait(600);
      await screenshot(page, 'context-menu-open');

      const menuItems = await page.locator('[role="menuitem"], [role="menu"] button, [class*="menu-item"], [class*="MenuItem"]').all();
      log(`Context menu items: ${menuItems.length}`);
      const menuTexts = [];
      for (const item of menuItems) {
        const t = await item.innerText().catch(() => '');
        if (t.trim()) {
          menuTexts.push(t.trim());
          log(`  menu item: "${t.trim()}"`);
        }
      }

      const hasRename = menuTexts.some(t => t.toLowerCase().includes('rename'));
      const hasColor = menuTexts.some(t => t.toLowerCase().includes('color') || t.toLowerCase().includes('colour'));
      const hasDelete = menuTexts.some(t => t.toLowerCase().includes('delete') || t.toLowerCase().includes('remove'));

      if (hasRename) logFinding('Three-dot menu: Rename', 'Rename option present in calendar context menu');
      else logIssue('MAJOR', 'Three-dot menu: no Rename option', `Context menu opened but no Rename option found. Items: [${menuTexts.join(', ')}]`);

      if (hasColor) logFinding('Three-dot menu: Color change', 'Color option present in context menu');
      else logIssue('MAJOR', 'Three-dot menu: no Color option', `Context menu missing color change option. Items: [${menuTexts.join(', ')}]`);

      if (!hasRename && !hasColor && menuTexts.length === 0) {
        logIssue('CRITICAL', 'Context menu is empty', 'Calendar item context menu opened but contains no menu items');
      }

      await page.keyboard.press('Escape');
      await wait(300);
    } else {
      logIssue('MAJOR', 'No three-dot menu on sidebar item hover', 'Hovering a calendar sidebar item did not reveal a three-dot/options/context menu button');
    }
  } else {
    logIssue('MAJOR', 'No sidebar calendar items for three-dot test', 'No calendar items found in sidebar to test the context menu');
  }

  // ─── FLOW 11: Create new calendar from "+" button ─────────────────────────
  console.log('');
  console.log('FLOW 11: Create new calendar from sidebar "+" button');

  const addCalBtn = await findVisible(page, [
    'button[aria-label*="add calendar" i]',
    'button[aria-label*="new calendar" i]',
    'button[aria-label*="create calendar" i]',
    '[class*="AddCalendar"]',
    '[class*="add-calendar"]',
    // Common pattern: section header with a + button
    '[class*="CalendarSidebar"] button[aria-label="+"]',
    'aside button[aria-label="+"]',
    'aside button:has-text("+")',
  ]);

  // Also look for + buttons specifically near calendar section headers
  const plusButtons = await page.locator('aside button, [class*="sidebar"] button').all();
  log(`All sidebar buttons for + scan: ${plusButtons.length}`);
  for (const btn of plusButtons) {
    const txt = await btn.innerText().catch(() => '');
    const ariaLabel = await btn.getAttribute('aria-label').catch(() => '');
    log(`  btn: text="${txt.trim()}" aria="${ariaLabel}"`);
  }

  if (!addCalBtn) {
    logIssue('MAJOR', 'No "add calendar" + button found', 'Cannot find a "+" or "Add Calendar" button in the sidebar');
  } else {
    await addCalBtn.click();
    await wait(900);
    await screenshot(page, 'add-calendar-clicked');

    // Look for any input that appeared
    const newCalInput = await findVisible(page, [
      'input[placeholder*="calendar name" i]',
      'input[placeholder*="name" i]',
      'input[placeholder*="new calendar" i]',
      '[role="dialog"] input',
    ]);

    if (newCalInput) {
      logFinding('Add calendar: name input', 'Calendar name input appeared after clicking +');
      await newCalInput.fill('UX Test Calendar');
      await screenshot(page, 'add-calendar-filled');

      // Try to cancel / not actually create
      await page.keyboard.press('Escape');
      await wait(400);
    } else {
      // Check for any modal
      const modal = await findVisible(page, ['[role="dialog"]', '[class*="modal"]', '[class*="Modal"]']);
      if (modal) {
        logFinding('Add calendar: dialog opened', 'Dialog appeared after clicking + but input not clearly identified');
        await screenshot(page, 'add-calendar-dialog');
        await page.keyboard.press('Escape');
        await wait(400);
      } else {
        logIssue('MAJOR', 'Add calendar: no UI response', '"+" button clicked but no input field or dialog appeared');
      }
    }
  }

  // ─── FLOW 12: Week View — Drag-and-drop rescheduling ─────────────────────
  console.log('');
  console.log('FLOW 12: Drag-and-drop event rescheduling in Week view');

  // Switch to Week view
  const weekBtnForDrag = await findVisible(page, ['button:has-text("Week")', '[data-view="week"]']);
  if (!weekBtnForDrag) {
    logIssue('MAJOR', 'Cannot access Week view for drag test', 'Week view button not found');
  } else {
    await weekBtnForDrag.click();
    await wait(1200);
    await screenshot(page, 'week-view-for-drag');

    // Find events in week view
    let weekEvent = null;
    for (const sel of allEventSelectors) {
      const count = await page.locator(sel).count();
      if (count > 0) {
        weekEvent = page.locator(sel).first();
        log(`Found ${count} events in Week view with "${sel}"`);
        break;
      }
    }

    if (!weekEvent) {
      logNote('No events in Week view for current date. Navigate to a week with events for drag-and-drop test. Trying to navigate forward.');
      // Try clicking "Next" to find a week with events
      const nextBtn = await findVisible(page, ['button[aria-label*="next" i]', 'button:has-text(">")', 'button[aria-label*="forward" i]', 'button[aria-label="Next week"]']);
      if (nextBtn) {
        await nextBtn.click();
        await wait(1000);
        for (const sel of allEventSelectors) {
          const count = await page.locator(sel).count();
          if (count > 0) {
            weekEvent = page.locator(sel).first();
            log(`Found ${count} events after navigating forward`);
            break;
          }
        }
      }
    }

    if (!weekEvent) {
      logIssue('MINOR', 'No events available for drag-and-drop test', 'Week view has no events in current or next week to test rescheduling');
    } else {
      const eventBox = await weekEvent.boundingBox();
      log(`Event bounding box: x=${eventBox?.x?.toFixed(0)} y=${eventBox?.y?.toFixed(0)} w=${eventBox?.width?.toFixed(0)} h=${eventBox?.height?.toFixed(0)}`);

      if (eventBox) {
        const startX = eventBox.x + eventBox.width / 2;
        const startY = eventBox.y + eventBox.height / 2;
        const targetY = startY + 80; // ~1 hour down

        // Perform drag
        await page.mouse.move(startX, startY);
        await wait(400);
        await page.mouse.down();
        await wait(400);
        // Move slowly in steps
        await page.mouse.move(startX, startY + 5, { steps: 3 });
        await wait(200);
        await page.mouse.move(startX, startY + 20, { steps: 5 });
        await wait(200);
        await page.mouse.move(startX, targetY, { steps: 15 });
        await wait(600);
        await screenshot(page, 'drag-in-progress');
        await page.mouse.up();
        await wait(1200);
        await screenshot(page, 'after-drag');

        // Check for confirmation dialog (CLAUDE.md notes this exists)
        const confirmDialog = await findVisible(page, [
          '[role="dialog"]',
          '[class*="confirm"]',
          '[class*="Confirm"]',
          '[class*="reschedule"]',
          '[class*="Reschedule"]',
        ]);

        if (confirmDialog) {
          const dialogText = await confirmDialog.innerText().catch(() => '');
          log(`Drag confirmation dialog: "${dialogText.substring(0, 200)}"`);
          logFinding('Drag reschedule: confirmation dialog', 'Reschedule confirmation dialog appeared after drag');

          // Check for notify attendees option (CLAUDE.md notes this)
          const notifyOption = await page.locator('[class*="notify"], input[type="checkbox"]').first();
          if (await notifyOption.count() > 0 && await notifyOption.isVisible()) {
            logFinding('Drag reschedule: notify attendees option', 'Notify attendees option present in reschedule dialog');
          } else {
            logNote('Notify attendees option not visible in reschedule dialog (CLAUDE.md notes this is a no-op placeholder)');
          }

          // Cancel the dialog
          const cancelBtn = await findVisible(page, [
            'button:has-text("Cancel")',
            'button:has-text("Revert")',
            '[role="dialog"] button:last-of-type',
          ]);
          if (cancelBtn) {
            await cancelBtn.click();
          } else {
            await page.keyboard.press('Escape');
          }
          await wait(600);
        } else {
          // Check if event moved
          const newBox = await weekEvent.boundingBox().catch(() => null);
          if (newBox && eventBox && Math.abs(newBox.y - eventBox.y) > 15) {
            logFinding('Drag reschedule: event moved', `Event position changed from y=${eventBox.y.toFixed(0)} to y=${newBox.y.toFixed(0)} without confirmation dialog`);
            logNote('Drag rescheduling works but there is no confirmation step — changes are immediate');
          } else {
            logIssue('MAJOR', 'Drag-and-drop: event did not move', 'Attempted drag-and-drop reschedule but event position unchanged and no dialog appeared');
          }
        }
      } else {
        logIssue('MINOR', 'Cannot get drag event bounding box', 'Event element found but getBoundingClientRect returned null');
      }
    }
  }

  // ─── FLOW 13: Event Resize in Week View ──────────────────────────────────
  console.log('');
  console.log('FLOW 13: Event resize in Week view');

  await screenshot(page, 'week-view-for-resize');

  // Look for resize handles
  const resizeHandleSelectors = [
    '.fc-event-resizer',
    '.fc-event-resizer-end',
    '[class*="resize-handle"]',
    '[class*="ResizeHandle"]',
    '[class*="resize-grip"]',
    '[class*="resizer"]',
  ];

  let resizeHandle = null;
  let resizeHandleSel = '';
  for (const sel of resizeHandleSelectors) {
    const count = await page.locator(sel).count();
    if (count > 0) {
      resizeHandle = page.locator(sel).first();
      resizeHandleSel = sel;
      log(`Found ${count} resize handles with "${sel}"`);
      break;
    }
  }

  if (!resizeHandle) {
    logIssue('MAJOR', 'No resize handles found on events', `Week view events do not have resize handles. Tried: ${resizeHandleSelectors.join(', ')}`);
  } else {
    logFinding('Resize handles', `Resize handles found on events (selector: ${resizeHandleSel})`);

    const handleBox = await resizeHandle.boundingBox();
    if (handleBox) {
      const hx = handleBox.x + handleBox.width / 2;
      const hy = handleBox.y + handleBox.height / 2;

      await page.mouse.move(hx, hy);
      await wait(400);
      await page.mouse.down();
      await wait(300);
      await page.mouse.move(hx, hy + 10, { steps: 3 });
      await wait(200);
      await page.mouse.move(hx, hy + 60, { steps: 12 });
      await wait(500);
      await screenshot(page, 'resize-in-progress');
      await page.mouse.up();
      await wait(1200);
      await screenshot(page, 'after-resize');

      const confirmDialog2 = await findVisible(page, ['[role="dialog"]', '[class*="confirm"]', '[class*="Reschedule"]']);
      if (confirmDialog2) {
        const dialogText = await confirmDialog2.innerText().catch(() => '');
        log(`Resize confirmation dialog: "${dialogText.substring(0, 200)}"`);
        logFinding('Resize: confirmation dialog', 'Resize triggered confirmation dialog');
        await page.keyboard.press('Escape');
        await wait(500);
      } else {
        logNote('Resize: no confirmation dialog appeared — change may be immediate or failed silently');
      }
    } else {
      logIssue('MINOR', 'Resize handle has no bounding box', 'Resize handle found in DOM but cannot get position');
    }
  }

  // ─── FINAL SCREENSHOT ─────────────────────────────────────────────────────
  await screenshot(page, 'final-state');

  await browser.close();
  printReport();
}

const panelSelectors = [
  '[role="dialog"]',
  '[class*="modal"]',
  '[class*="Modal"]',
  '[class*="drawer"]',
  '[class*="Drawer"]',
  '[class*="panel"]',
  '[class*="Panel"]',
  '[class*="create-event"]',
  '[class*="CreateEvent"]',
  '[class*="EventForm"]',
  '[class*="event-form"]',
  '[class*="SlideOver"]',
  '[class*="side-panel"]',
  '[class*="SidePanel"]',
  '[class*="EventDetail"]',
  '[class*="event-detail"]',
];

function printReport() {
  console.log('');
  console.log('='.repeat(65));
  console.log('USER TESTING REPORT — CALENDAR MODULE');
  console.log('='.repeat(65));

  const critical = issues.filter(i => i.severity === 'CRITICAL');
  const major = issues.filter(i => i.severity === 'MAJOR');
  const minor = issues.filter(i => i.severity === 'MINOR');

  console.log('');
  console.log('SUMMARY');
  console.log(`  Findings (passing): ${findings.length}`);
  console.log(`  Issues total:       ${issues.length}`);
  console.log(`    CRITICAL: ${critical.length}`);
  console.log(`    MAJOR:    ${major.length}`);
  console.log(`    MINOR:    ${minor.length}`);
  console.log(`  Notes:     ${notes.length}`);

  if (critical.length > 0) {
    console.log('');
    console.log('CRITICAL ISSUES (block user progress)');
    critical.forEach((i, idx) => {
      console.log(`  ${idx + 1}. ${i.title}`);
      console.log(`     ${i.detail}`);
    });
  }

  if (major.length > 0) {
    console.log('');
    console.log('MAJOR ISSUES (significantly frustrate users)');
    major.forEach((i, idx) => {
      console.log(`  ${idx + 1}. ${i.title}`);
      console.log(`     ${i.detail}`);
    });
  }

  if (minor.length > 0) {
    console.log('');
    console.log('MINOR ISSUES (suboptimal UX)');
    minor.forEach((i, idx) => {
      console.log(`  ${idx + 1}. ${i.title}`);
      console.log(`     ${i.detail}`);
    });
  }

  if (findings.length > 0) {
    console.log('');
    console.log('WHAT WORKED');
    findings.forEach((f, idx) => {
      console.log(`  ${idx + 1}. ${f.title}`);
      console.log(`     ${f.detail}`);
    });
  }

  if (notes.length > 0) {
    console.log('');
    console.log('NOTES / OBSERVATIONS');
    notes.forEach((n, idx) => {
      console.log(`  ${idx + 1}. ${n}`);
    });
  }

  console.log('');
  console.log(`Screenshots: ${SCREENSHOTS_DIR}`);
  console.log('');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  console.error(err.stack);
  printReport();
  process.exit(1);
});
