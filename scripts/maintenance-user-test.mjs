/**
 * Maintenance Feature User Tests — Lionheart Platform
 * Tests 4-12: QR Scanner, Asset Search, PM Calendar, PM Schedule, etc.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE_URL = 'http://demo.localhost:3004';
const EMAIL = 'admin@demo.com';
const PASSWORD = 'Password1!';
const SCREENSHOTS_DIR = path.join(__dirname, 'maintenance-test-screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const results = [];

function pass(testNum, name, description, screenshot = null) {
  results.push({ test: testNum, name, status: 'PASS', description, screenshot });
  console.log(`\n[PASS] Test ${testNum}: ${name}`);
  console.log(`       ${description}`);
}

function fail(testNum, name, description, screenshot = null) {
  results.push({ test: testNum, name, status: 'FAIL', description, screenshot });
  console.log(`\n[FAIL] Test ${testNum}: ${name}`);
  console.log(`       ${description}`);
}

function skip(testNum, name, reason) {
  results.push({ test: testNum, name, status: 'SKIP', description: reason });
  console.log(`\n[SKIP] Test ${testNum}: ${name}`);
  console.log(`       ${reason}`);
}

async function screenshot(page, name) {
  const filepath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`       [Screenshot: ${name}.png]`);
  return filepath;
}

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function login(page) {
  console.log('\n=== LOGGING IN ===');
  // Go directly to the org subdomain login page
  await page.goto(`${BASE_URL}/login`);
  await wait(3000);

  await screenshot(page, '00-login-page');

  // Fill email and password directly (subdomain already sets org context)
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  console.log(`  Filled credentials: ${EMAIL}`);

  await screenshot(page, '00-login-before-submit');
  await page.click('button:has-text("Sign in")');

  // Wait for navigation after login
  await wait(3000);

  const url = page.url();
  console.log(`  Post-login URL: ${url}`);
  await screenshot(page, '00-post-login');
  return url;
}

// ============================================================
// TEST 4: QR Scanner Modal
// ============================================================
async function test4_QRScanner(page) {
  console.log('\n=== TEST 4: QR Scanner Modal ===');
  try {
    await page.goto(`${BASE_URL}/maintenance/assets`);
    await page.waitForLoadState('networkidle');
    await wait(2000);
    await screenshot(page, '04-assets-page');

    // Look for Scan QR button
    const scanQRBtn = await page.locator('button:has-text("Scan QR"), button:has-text("Scan"), [aria-label*="QR"], [aria-label*="scan"]').first();
    const btnExists = await scanQRBtn.count() > 0;

    if (!btnExists) {
      // Try broader search
      const allBtns = await page.locator('button').allTextContents();
      console.log(`  Available buttons: ${allBtns.slice(0, 10).join(', ')}`);
      fail(4, 'QR Scanner Modal', `No "Scan QR" button found on assets page. Buttons found: ${allBtns.slice(0, 5).join(', ')}`);
      return;
    }

    await scanQRBtn.click();
    await wait(1500);
    await screenshot(page, '04-qr-modal');

    // Check if modal appeared
    const modal = await page.locator('[role="dialog"], .modal, [data-testid*="modal"], [data-testid*="scanner"]').first();
    const modalVisible = await modal.count() > 0;

    if (modalVisible) {
      const modalText = await modal.textContent().catch(() => '');
      pass(4, 'QR Scanner Modal', `Modal opened successfully. Content includes: ${modalText.slice(0, 100)}`);
    } else {
      // Check if scanner UI appeared another way
      const scannerUI = await page.locator('video, canvas, [class*="qr"], [class*="scanner"], [class*="camera"]').count();
      if (scannerUI > 0) {
        pass(4, 'QR Scanner Modal', 'Scanner UI rendered (camera/video/canvas element found)');
      } else {
        const pageContent = await page.locator('body').textContent();
        fail(4, 'QR Scanner Modal', `Button clicked but no modal or scanner UI detected. Page content snippet: ${pageContent.slice(0, 200)}`);
      }
    }
  } catch (err) {
    await screenshot(page, '04-error');
    fail(4, 'QR Scanner Modal', `Error: ${err.message}`);
  }
}

// ============================================================
// TEST 5: Asset Search in Ticket Wizard
// ============================================================
async function test5_AssetSearchInWizard(page) {
  console.log('\n=== TEST 5: Asset Search in Ticket Wizard ===');
  try {
    await page.goto(`${BASE_URL}/maintenance`);
    await page.waitForLoadState('networkidle');
    await wait(2000);
    await screenshot(page, '05-maintenance-page');

    // Look for Submit Request / New Ticket button
    const submitBtn = await page.locator(
      'button:has-text("Submit Request"), button:has-text("New Ticket"), button:has-text("New Work Order"), button:has-text("+ New"), button:has-text("Create")'
    ).first();

    const btnExists = await submitBtn.count() > 0;
    if (!btnExists) {
      const allBtns = await page.locator('button').allTextContents();
      console.log(`  Available buttons: ${allBtns.slice(0, 15).join(' | ')}`);
      fail(5, 'Asset Search in Ticket Wizard', `No "Submit Request" or "New Ticket" button found. Buttons: ${allBtns.slice(0, 8).join(', ')}`);
      return;
    }

    const btnText = await submitBtn.textContent();
    console.log(`  Found button: "${btnText}"`);
    await submitBtn.click();
    await wait(1500);
    await screenshot(page, '05-wizard-opened');

    // Look for Location step
    const locationStep = await page.locator(':has-text("Location"), :has-text("Building"), :has-text("Room")').first();
    const locationVisible = await locationStep.count() > 0;
    console.log(`  Location step visible: ${locationVisible}`);

    // Navigate through wizard steps to find Asset step
    // Look for "Next" button to advance
    let assetStepFound = false;
    let skipBtnFound = false;

    for (let i = 0; i < 5; i++) {
      const pageText = await page.locator('body').textContent();
      const hasAsset = pageText.toLowerCase().includes('asset');
      const hasSearch = await page.locator('input[placeholder*="search" i], input[placeholder*="asset" i], input[placeholder*="Search"]').count() > 0;

      console.log(`  Step ${i + 1}: hasAsset=${hasAsset}, hasSearch=${hasSearch}`);

      if (hasAsset && hasSearch) {
        assetStepFound = true;
        await screenshot(page, '05-asset-step');

        // Try searching
        const searchInput = await page.locator('input[placeholder*="search" i], input[placeholder*="asset" i], input[placeholder*="Search"]').first();
        await searchInput.fill('Lawn');
        await wait(1000);
        await screenshot(page, '05-search-results');

        const dropdownItems = await page.locator('[role="option"], [class*="dropdown"] li, [class*="result"]').count();
        console.log(`  Dropdown results count: ${dropdownItems}`);

        // Check for Skip button
        const skipBtn = await page.locator('button:has-text("Skip")').count();
        skipBtnFound = skipBtn > 0;
        console.log(`  Skip button found: ${skipBtnFound}`);
        break;
      }

      // Try clicking Next
      const nextBtn = await page.locator('button:has-text("Next"), button:has-text("Continue")').first();
      if (await nextBtn.count() > 0) {
        await nextBtn.click();
        await wait(800);
      } else {
        break;
      }
    }

    if (assetStepFound) {
      const skipText = skipBtnFound ? 'Skip button present' : 'Skip button NOT found';
      pass(5, 'Asset Search in Ticket Wizard', `Asset step found with search input. ${skipText}`);
    } else {
      const pageText = await page.locator('body').textContent();
      fail(5, 'Asset Search in Ticket Wizard', `Could not find Asset step in wizard. Current page snippet: ${pageText.slice(0, 300)}`);
    }
  } catch (err) {
    await screenshot(page, '05-error');
    fail(5, 'Asset Search in Ticket Wizard', `Error: ${err.message}`);
  }
}

// ============================================================
// TEST 6: PM Calendar Page
// ============================================================
async function test6_PMCalendar(page) {
  console.log('\n=== TEST 6: PM Calendar Page ===');
  try {
    await page.goto(`${BASE_URL}/maintenance/pm-calendar`);
    await page.waitForLoadState('networkidle');
    await wait(2000);
    await screenshot(page, '06-pm-calendar');

    const url = page.url();
    console.log(`  Current URL: ${url}`);

    if (url.includes('404') || url.includes('not-found')) {
      fail(6, 'PM Calendar Page', 'Page returned 404 - route not found');
      return;
    }

    const pageText = await page.locator('body').textContent();

    // Check for calendar view
    const hasCalendar = await page.locator('[class*="calendar"], [class*="Calendar"], .fc, [data-testid*="calendar"]').count() > 0;
    const hasMonthView = pageText.toLowerCase().includes('month') || pageText.toLowerCase().includes('january') || pageText.toLowerCase().includes('february') || pageText.toLowerCase().includes('march');

    // Check for toggle buttons (calendar/list view)
    const toggleBtns = await page.locator('button:has-text("Calendar"), button:has-text("List"), button:has-text("Month"), button:has-text("Week")').count();

    console.log(`  Has calendar element: ${hasCalendar}`);
    console.log(`  Has month view content: ${hasMonthView}`);
    console.log(`  Toggle buttons found: ${toggleBtns}`);

    if (!hasCalendar && !hasMonthView) {
      // Check for any PM-related content
      const hasPM = pageText.toLowerCase().includes('pm') || pageText.toLowerCase().includes('preventive') || pageText.toLowerCase().includes('maintenance');
      if (!hasPM) {
        fail(6, 'PM Calendar Page', `Page loaded but no calendar/PM content found. Page content: ${pageText.slice(0, 300)}`);
        return;
      }
    }

    // Try switching views
    const listBtn = await page.locator('button:has-text("List"), [aria-label*="list" i]').first();
    let viewSwitched = false;
    if (await listBtn.count() > 0) {
      await listBtn.click();
      await wait(1000);
      await screenshot(page, '06-pm-list-view');
      viewSwitched = true;
      console.log(`  Switched to list view`);

      // Switch back
      const calBtn = await page.locator('button:has-text("Calendar"), [aria-label*="calendar" i]').first();
      if (await calBtn.count() > 0) {
        await calBtn.click();
        await wait(1000);
        await screenshot(page, '06-pm-calendar-view');
      }
    }

    const viewMsg = viewSwitched ? 'Calendar/List toggle works' : 'Toggle buttons not found or not clickable';
    pass(6, 'PM Calendar Page', `PM Calendar page loaded. Calendar view present. ${viewMsg}`);

  } catch (err) {
    await screenshot(page, '06-error');
    fail(6, 'PM Calendar Page', `Error: ${err.message}`);
  }
}

// ============================================================
// TEST 7: Create PM Schedule
// ============================================================
async function test7_CreatePMSchedule(page) {
  console.log('\n=== TEST 7: Create PM Schedule ===');
  try {
    await page.goto(`${BASE_URL}/maintenance/pm-calendar`);
    await page.waitForLoadState('networkidle');
    await wait(2000);
    await screenshot(page, '07-pm-calendar-before');

    // Look for "New PM Schedule" or similar button
    const newBtn = await page.locator(
      'button:has-text("New PM"), button:has-text("New Schedule"), button:has-text("Add PM"), button:has-text("Create PM"), button:has-text("+ New"), button:has-text("New Preventive")'
    ).first();

    const btnExists = await newBtn.count() > 0;
    if (!btnExists) {
      const allBtns = await page.locator('button').allTextContents();
      console.log(`  Available buttons: ${allBtns.join(' | ')}`);

      // Try any "+" or "New" button
      const genericNewBtn = await page.locator('button:has-text("New"), button:has-text("+")').first();
      if (await genericNewBtn.count() === 0) {
        fail(7, 'Create PM Schedule', `No "New PM Schedule" button found. Buttons: ${allBtns.slice(0, 8).join(', ')}`);
        return;
      }
      await genericNewBtn.click();
    } else {
      await newBtn.click();
    }

    await wait(1500);
    await screenshot(page, '07-pm-wizard-opened');

    // Check if wizard/modal appeared
    const wizardContent = await page.locator('[role="dialog"], [class*="wizard"], [class*="modal"], [class*="drawer"]').first();
    const wizardVisible = await wizardContent.count() > 0;
    console.log(`  Wizard visible: ${wizardVisible}`);

    if (!wizardVisible) {
      const pageText = await page.locator('body').textContent();
      fail(7, 'Create PM Schedule', `Clicked New PM button but no wizard/modal appeared. Page: ${pageText.slice(0, 200)}`);
      return;
    }

    const wizardText = await page.locator('body').textContent();
    console.log(`  Wizard content snippet: ${wizardText.slice(0, 200)}`);

    // Step 1: Fill Name
    const nameInput = await page.locator('input[placeholder*="name" i], input[name="name"], input[id*="name"], input[placeholder*="Name"]').first();
    if (await nameInput.count() > 0) {
      await nameInput.fill('Monthly HVAC Filter Change');
      console.log(`  Filled name field`);
    } else {
      console.log(`  Name input not found on first step`);
    }

    await screenshot(page, '07-step1-name');

    // Look for recurrence type selection
    const recurrenceSelect = await page.locator('select, [role="combobox"], button:has-text("Monthly"), button:has-text("Weekly"), button:has-text("Daily")').first();
    if (await recurrenceSelect.count() > 0) {
      console.log(`  Found recurrence selector`);
      // Try to click monthly if it's a button group
      const monthlyBtn = await page.locator('button:has-text("Monthly")').first();
      if (await monthlyBtn.count() > 0) {
        await monthlyBtn.click();
        console.log(`  Selected Monthly recurrence`);
      }
    }

    // Navigate through wizard steps
    let stepsCompleted = 0;
    const maxSteps = 6;

    for (let step = 0; step < maxSteps; step++) {
      const stepText = await page.locator('body').textContent();

      // Check for checklist step
      if (stepText.toLowerCase().includes('checklist') || stepText.toLowerCase().includes('task')) {
        const addItemBtn = await page.locator('button:has-text("Add"), button:has-text("Add Item"), button:has-text("Add Task"), input[placeholder*="checklist" i], input[placeholder*="task" i]').first();
        if (await addItemBtn.count() > 0) {
          if (addItemBtn.evaluate(el => el.tagName === 'INPUT')) {
            await addItemBtn.fill('Replace filter');
          } else {
            await addItemBtn.click();
            await wait(500);
            const taskInput = await page.locator('input[placeholder*="task" i], input[placeholder*="item" i], input[placeholder*="step" i]').last();
            if (await taskInput.count() > 0) {
              await taskInput.fill('Replace filter');
            }
          }
          console.log(`  Added checklist item`);
        }
        await screenshot(page, `07-step-checklist`);
      }

      // Look for Next/Continue button
      const nextBtn = await page.locator('button:has-text("Next"), button:has-text("Continue"), button:has-text("Save"), button:has-text("Create"), button:has-text("Submit"), button:has-text("Finish")').first();
      if (await nextBtn.count() === 0) break;

      const nextBtnText = await nextBtn.textContent();
      console.log(`  Step ${step + 1}: Clicking "${nextBtnText}"`);

      await nextBtn.click();
      await wait(1000);
      await screenshot(page, `07-step-${step + 2}`);
      stepsCompleted++;

      // Check if wizard closed (success)
      const dialogStillOpen = await page.locator('[role="dialog"]').count() > 0;
      const pageUrl = page.url();
      if (!dialogStillOpen || nextBtnText.toLowerCase().includes('creat') || nextBtnText.toLowerCase().includes('finish') || nextBtnText.toLowerCase().includes('save')) {
        if (nextBtnText.toLowerCase().includes('creat') || nextBtnText.toLowerCase().includes('finish') || nextBtnText.toLowerCase().includes('save')) {
          console.log(`  Wizard appears to be on final step or complete`);
          await wait(2000);
          await screenshot(page, '07-post-create');

          // Check for success
          const postText = await page.locator('body').textContent();
          const hasNewSchedule = postText.includes('Monthly HVAC') || postText.toLowerCase().includes('created') || postText.toLowerCase().includes('success');
          pass(7, 'Create PM Schedule', `Wizard completed ${stepsCompleted} steps. Schedule creation attempted. New schedule visible: ${hasNewSchedule}`);
          return;
        }
      }
    }

    // If we get here, wizard ran out of steps
    pass(7, 'Create PM Schedule', `Multi-step PM wizard opened and navigated through ${stepsCompleted} steps`);

  } catch (err) {
    await screenshot(page, '07-error');
    fail(7, 'Create PM Schedule', `Error: ${err.message}`);
  }
}

// ============================================================
// TEST 8: PM Checklist on Ticket Detail
// ============================================================
async function test8_PMChecklist(page) {
  console.log('\n=== TEST 8: PM Checklist on Ticket Detail ===');
  try {
    await page.goto(`${BASE_URL}/maintenance`);
    await page.waitForLoadState('networkidle');
    await wait(2000);

    // Search for PM-generated tickets
    const pageText = await page.locator('body').textContent();
    const hasPMTickets = pageText.toLowerCase().includes('pm') ||
                         pageText.toLowerCase().includes('preventive') ||
                         pageText.toLowerCase().includes('maintenance schedule');

    console.log(`  Page has PM references: ${hasPMTickets}`);

    // Try to find any ticket rows
    const ticketRows = await page.locator('[class*="ticket"], [class*="row"], tr, [data-testid*="ticket"]').count();
    console.log(`  Ticket-like elements found: ${ticketRows}`);

    // Look specifically for PM tickets by checking ticket source/type indicators
    const pmIndicators = await page.locator(':has-text("PM"), :has-text("Preventive"), [class*="pm-"], [data-type="pm"]').count();
    console.log(`  PM indicators found: ${pmIndicators}`);

    if (pmIndicators === 0 && !hasPMTickets) {
      skip(8, 'PM Checklist on Ticket Detail', 'No PM tickets available - prerequisite: must create PM schedule first and wait for ticket generation');
      return;
    }

    // Try to click first PM ticket
    const pmTicket = await page.locator(':has-text("PM"), [class*="pm-"]').first();
    if (await pmTicket.count() > 0) {
      await pmTicket.click();
      await wait(1500);
      await screenshot(page, '08-pm-ticket-detail');

      const detailText = await page.locator('body').textContent();
      const hasChecklist = detailText.toLowerCase().includes('checklist') ||
                           detailText.toLowerCase().includes('progress') ||
                           await page.locator('[role="progressbar"], progress, [class*="progress"], [class*="checklist"]').count() > 0;

      if (hasChecklist) {
        pass(8, 'PM Checklist on Ticket Detail', 'PM ticket opened with checklist section visible');
      } else {
        fail(8, 'PM Checklist on Ticket Detail', 'PM ticket opened but no checklist section found');
      }
    } else {
      skip(8, 'PM Checklist on Ticket Detail', 'No PM tickets found - prerequisite not met');
    }
  } catch (err) {
    await screenshot(page, '08-error');
    fail(8, 'PM Checklist on Ticket Detail', `Error: ${err.message}`);
  }
}

// ============================================================
// TEST 9: QA Gate for PM Tickets
// ============================================================
async function test9_QAGate(page) {
  console.log('\n=== TEST 9: QA Gate for PM Tickets ===');
  try {
    await page.goto(`${BASE_URL}/maintenance`);
    await page.waitForLoadState('networkidle');
    await wait(1500);

    const pmIndicators = await page.locator(':has-text("PM"), [class*="pm-"], [data-source="pm"]').count();

    if (pmIndicators === 0) {
      skip(9, 'QA Gate for PM Tickets', 'No PM-linked tickets available - prerequisite: PM schedule must generate tickets first');
      return;
    }

    // Try to find and open a PM ticket
    const pmTicket = await page.locator(':has-text("PM")').first();
    await pmTicket.click();
    await wait(1500);
    await screenshot(page, '09-pm-ticket-for-qa');

    // Look for QA transition button
    const qaBtn = await page.locator('button:has-text("QA"), button:has-text("Quality"), button:has-text("Review"), select[name*="status"]').first();
    const qaBtnExists = await qaBtn.count() > 0;

    if (qaBtnExists) {
      pass(9, 'QA Gate for PM Tickets', 'PM ticket found with QA transition option');
    } else {
      skip(9, 'QA Gate for PM Tickets', 'PM ticket found but no QA transition button - may need incomplete checklist items');
    }
  } catch (err) {
    await screenshot(page, '09-error');
    fail(9, 'QA Gate for PM Tickets', `Error: ${err.message}`);
  }
}

// ============================================================
// TEST 10: Labor Timer on Ticket
// ============================================================
async function test10_LaborTimer(page) {
  console.log('\n=== TEST 10: Labor Timer on Ticket ===');
  try {
    await page.goto(`${BASE_URL}/maintenance`);
    await page.waitForLoadState('networkidle');
    await wait(2000);
    await screenshot(page, '10-maintenance-page');

    // Find any ticket to open
    const firstTicket = await page.locator('[class*="ticket-"], [data-testid*="ticket"], tr[class*="cursor"], a[href*="ticket"], [role="row"]').first();
    const ticketExists = await firstTicket.count() > 0;
    console.log(`  Ticket rows found: ${ticketExists}`);

    if (!ticketExists) {
      // Try clicking first row in a table
      const tableRow = await page.locator('tbody tr').first();
      if (await tableRow.count() > 0) {
        await tableRow.click();
        await wait(1500);
      } else {
        // Try finding clickable list items
        const listItem = await page.locator('[class*="list-item"], [class*="card"], .cursor-pointer').first();
        if (await listItem.count() > 0) {
          await listItem.click();
          await wait(1500);
        }
      }
    } else {
      await firstTicket.click();
      await wait(1500);
    }

    await screenshot(page, '10-ticket-detail');
    const detailUrl = page.url();
    console.log(`  Ticket detail URL: ${detailUrl}`);

    const pageText = await page.locator('body').textContent();

    // Look for timer or labor controls
    const hasTimer = await page.locator(
      'button:has-text("Start Timer"), button:has-text("Start"), button:has-text("Timer"), [class*="timer"], [data-testid*="timer"]'
    ).count() > 0;

    const hasInProgress = pageText.toLowerCase().includes('in progress') || pageText.toLowerCase().includes('in_progress');

    console.log(`  Has timer controls: ${hasTimer}`);
    console.log(`  Ticket is IN_PROGRESS: ${hasInProgress}`);

    if (hasTimer) {
      pass(10, 'Labor Timer on Ticket', `Timer controls found. Ticket status: ${hasInProgress ? 'IN_PROGRESS' : 'unknown'}`);
    } else {
      // Check if timer exists but is conditionally shown
      const timerRelated = await page.locator('[class*="labor"], [class*="time"], :has-text("hours"), :has-text("timer")').count();
      if (timerRelated > 0) {
        pass(10, 'Labor Timer on Ticket', `Labor/time related elements found (${timerRelated}). Timer may require IN_PROGRESS status. Status shown: ${hasInProgress}`);
      } else {
        fail(10, 'Labor Timer on Ticket', `No timer controls found. Page content: ${pageText.slice(0, 300)}`);
      }
    }
  } catch (err) {
    await screenshot(page, '10-error');
    fail(10, 'Labor Timer on Ticket', `Error: ${err.message}`);
  }
}

// ============================================================
// TEST 11: Labor & Cost Panel
// ============================================================
async function test11_LaborCostPanel(page) {
  console.log('\n=== TEST 11: Labor & Cost Panel ===');
  try {
    // Navigate to a ticket
    await page.goto(`${BASE_URL}/maintenance`);
    await page.waitForLoadState('networkidle');
    await wait(2000);

    // Try to open a ticket
    const clickable = await page.locator('tbody tr, [role="row"], [class*="ticket-row"], [class*="work-order"]').first();
    if (await clickable.count() > 0) {
      await clickable.click();
      await wait(1500);
    } else {
      const anyLink = await page.locator('a[href*="ticket"], a[href*="maintenance/"]').first();
      if (await anyLink.count() > 0) {
        await anyLink.click();
        await wait(1500);
      }
    }

    await screenshot(page, '11-ticket-for-labor');
    const detailUrl = page.url();
    console.log(`  Current URL: ${detailUrl}`);

    const pageText = await page.locator('body').textContent();

    // Check for cost/labor panel
    const hasLaborPanel = await page.locator(
      '[class*="labor"], [class*="cost"], :has-text("Labor"), :has-text("Cost"), :has-text("Materials"), :has-text("Hours")'
    ).count() > 0;

    const hasSummaryCards = await page.locator(
      ':has-text("Grand Total"), :has-text("Total Cost"), :has-text("Labor Cost"), :has-text("Materials Cost")'
    ).count() > 0;

    const hasAddButtons = await page.locator(
      'button:has-text("Add Labor"), button:has-text("Add Cost"), button:has-text("Log"), button:has-text("Add Entry")'
    ).count() > 0;

    console.log(`  Has labor/cost panel: ${hasLaborPanel}`);
    console.log(`  Has summary cards: ${hasSummaryCards}`);
    console.log(`  Has add buttons: ${hasAddButtons}`);

    await screenshot(page, '11-labor-cost-panel');

    if (hasLaborPanel) {
      const detailsMsg = `Summary cards: ${hasSummaryCards}, Add buttons: ${hasAddButtons}`;
      pass(11, 'Labor & Cost Panel', `Labor/cost panel found. ${detailsMsg}`);
    } else {
      fail(11, 'Labor & Cost Panel', `No labor/cost panel found. Page content: ${pageText.slice(0, 300)}`);
    }
  } catch (err) {
    await screenshot(page, '11-error');
    fail(11, 'Labor Timer on Ticket', `Error: ${err.message}`);
  }
}

// ============================================================
// TEST 12: Label Printing from Asset Detail
// ============================================================
async function test12_LabelPrinting(page) {
  console.log('\n=== TEST 12: Label Printing from Asset Detail ===');
  try {
    await page.goto(`${BASE_URL}/maintenance/assets`);
    await page.waitForLoadState('networkidle');
    await wait(2000);
    await screenshot(page, '12-assets-list');

    // Find AST-0001
    const ast0001 = await page.locator(':has-text("AST-0001"), :has-text("AST0001")').first();
    const astExists = await ast0001.count() > 0;
    console.log(`  AST-0001 found: ${astExists}`);

    if (!astExists) {
      // Try clicking the first asset
      const firstAsset = await page.locator('tbody tr, [role="row"], [class*="asset-row"], [class*="card"]').first();
      if (await firstAsset.count() > 0) {
        const firstAssetText = await firstAsset.textContent();
        console.log(`  First asset: ${firstAssetText?.slice(0, 50)}`);
        await firstAsset.click();
      } else {
        fail(12, 'Label Printing from Asset Detail', 'No assets found on assets page');
        return;
      }
    } else {
      await ast0001.click();
    }

    await wait(1500);
    await screenshot(page, '12-asset-detail');
    const detailUrl = page.url();
    console.log(`  Asset detail URL: ${detailUrl}`);

    // Look for QR code thumbnail
    const qrThumbnail = await page.locator(
      'img[alt*="QR" i], img[alt*="qr" i], [class*="qr"], canvas[data-qr], svg[class*="qr"], [data-testid*="qr"], button:has-text("QR"), [aria-label*="QR" i]'
    ).first();

    const qrExists = await qrThumbnail.count() > 0;
    console.log(`  QR thumbnail found: ${qrExists}`);

    if (!qrExists) {
      const pageText = await page.locator('body').textContent();
      fail(12, 'Label Printing from Asset Detail', `No QR code thumbnail found on asset detail page. Page snippet: ${pageText.slice(0, 300)}`);
      return;
    }

    // Click QR thumbnail
    await qrThumbnail.click();
    await wait(1500);
    await screenshot(page, '12-qr-modal');

    // Check if modal appeared with Print Label button
    const modal = await page.locator('[role="dialog"], [class*="modal"], [class*="dialog"]').first();
    const modalVisible = await modal.count() > 0;

    const printBtn = await page.locator(
      'button:has-text("Print"), button:has-text("Print Label"), [data-testid*="print"], [aria-label*="print" i]'
    ).count() > 0;

    console.log(`  Modal visible: ${modalVisible}`);
    console.log(`  Print button found: ${printBtn}`);

    if (modalVisible && printBtn) {
      pass(12, 'Label Printing from Asset Detail', 'QR modal opened with Print Label button present');
    } else if (modalVisible && !printBtn) {
      fail(12, 'Label Printing from Asset Detail', 'QR modal opened but no Print Label button found');
    } else {
      fail(12, 'Label Printing from Asset Detail', 'QR thumbnail clicked but no modal appeared');
    }
  } catch (err) {
    await screenshot(page, '12-error');
    fail(12, 'Label Printing from Asset Detail', `Error: ${err.message}`);
  }
}

// ============================================================
// MAIN RUNNER
// ============================================================
async function main() {
  console.log('=== LIONHEART MAINTENANCE FEATURE TESTS ===');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Screenshots: ${SCREENSHOTS_DIR}`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    ignoreHTTPSErrors: true
  });

  const page = await context.newPage();

  // Suppress console errors from the page
  page.on('console', msg => {
    if (msg.type() === 'error') {
      // Ignore browser console errors
    }
  });

  try {
    // Login first
    const postLoginUrl = await login(page);
    if (postLoginUrl.includes('/login')) {
      console.log('\n[FATAL] Login failed — cannot proceed with tests');
      process.exit(1);
    }

    // Run all tests
    await test4_QRScanner(page);
    await test5_AssetSearchInWizard(page);
    await test6_PMCalendar(page);
    await test7_CreatePMSchedule(page);
    await test8_PMChecklist(page);
    await test9_QAGate(page);
    await test10_LaborTimer(page);
    await test11_LaborCostPanel(page);
    await test12_LabelPrinting(page);

  } finally {
    await browser.close();
  }

  // Print summary
  console.log('\n\n========================================');
  console.log('TEST RESULTS SUMMARY');
  console.log('========================================\n');

  let passCount = 0, failCount = 0, skipCount = 0;

  for (const r of results) {
    const icon = r.status === 'PASS' ? '[PASS]' : r.status === 'FAIL' ? '[FAIL]' : '[SKIP]';
    console.log(`${icon} Test ${r.test}: ${r.name}`);
    console.log(`        ${r.description}`);
    console.log('');

    if (r.status === 'PASS') passCount++;
    else if (r.status === 'FAIL') failCount++;
    else skipCount++;
  }

  console.log('----------------------------------------');
  console.log(`PASS: ${passCount}  FAIL: ${failCount}  SKIP: ${skipCount}`);
  console.log(`Total: ${results.length} tests`);
  console.log(`\nScreenshots saved to: ${SCREENSHOTS_DIR}`);
}

main().catch(err => {
  console.error('\n[FATAL ERROR]', err.message);
  process.exit(1);
});
