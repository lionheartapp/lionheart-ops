/**
 * Deep QA Test — Targeted investigation of issues + areas not covered
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://linfield-christian-school.lionheartapp.com';
const EMAIL = 'mkerley@linfield.com';
const PASSWORD = 'TestLionheart2024!';
const SCREENSHOTS_DIR = path.join(process.cwd(), 'scripts/qa-test-screenshots');

const findings = [];

function log(category, severity, title, details) {
  const entry = { category, severity, title, details };
  findings.push(entry);
  const prefix = severity === 'BUG' ? `[BUG]` : severity === 'UX' ? `[UX]` : `[OK]`;
  console.log(`  ${prefix} ${title}`);
  if (details) console.log(`       -> ${details}`);
}

async function ss(page, name) {
  const fp = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: fp, fullPage: true });
  console.log(`  [SS] ${name}.png`);
}

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function login(page) {
  await page.goto(`${BASE_URL}/login`);
  await wait(1500);
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.keyboard.press('Enter');
  await wait(3000);
}

async function run() {
  const browser = await chromium.launch({ headless: false, slowMo: 150 });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push({ text: msg.text(), url: page.url() });
  });

  try {
    await login(page);
    console.log('Logged in successfully\n');

    // =========================================================
    // A. SETTINGS — Find Profile Tab (investigate what tabs exist)
    // =========================================================
    console.log('=== A. SETTINGS — FULL TAB INVESTIGATION ===');
    await page.goto(`${BASE_URL}/settings`);
    await wait(3000);
    await ss(page, 'A01-settings-overview');

    // Get all visible tabs
    const allTabs = await page.locator('[role="tab"], button[class*="tab"], [class*="Tab"]').all();
    console.log(`  Found ${allTabs.length} tab elements`);
    for (const tab of allTabs) {
      const text = (await tab.textContent())?.trim();
      const isVisible = await tab.isVisible();
      if (isVisible && text) console.log(`    Tab: "${text}"`);
    }

    // Check all settings navigation links
    const settingsNavLinks = await page.locator('a, button').all();
    const settingsNavTexts = [];
    for (const link of settingsNavLinks) {
      try {
        const text = (await link.textContent())?.trim();
        const isVisible = await link.isVisible();
        if (isVisible && text && text.length < 50) settingsNavTexts.push(text);
      } catch {}
    }
    console.log(`  All visible interactive text elements: ${[...new Set(settingsNavTexts)].join(', ')}`);

    // Check sidebar navigation items specifically
    const sidebarLinks = await page.locator('aside a, nav a, [class*="sidebar"] a, [class*="Sidebar"] a').all();
    console.log(`  Sidebar links found: ${sidebarLinks.length}`);
    for (const link of sidebarLinks) {
      const text = (await link.textContent())?.trim();
      const href = await link.getAttribute('href');
      if (text) console.log(`    -> "${text}" (${href})`);
    }

    // Navigate to /settings/profile if it exists
    await page.goto(`${BASE_URL}/settings/profile`);
    await wait(2000);
    await ss(page, 'A02-settings-profile-direct');
    const profileUrl = page.url();
    console.log(`  /settings/profile URL: ${profileUrl}`);

    if (!profileUrl.includes('404') && !profileUrl.includes('error')) {
      log('settings', 'OK', 'Profile page exists at /settings/profile', profileUrl);
    } else {
      log('settings', 'BUG', 'Profile page does not exist', 'No route at /settings/profile');
    }

    // Check what the settings page structure looks like
    await page.goto(`${BASE_URL}/settings`);
    await wait(2000);

    // Look for the header/title of the page to understand which settings section we're on
    const h1s = await page.locator('h1, h2, [class*="heading"], [class*="title"]').all();
    for (const h of h1s) {
      const text = (await h.textContent())?.trim();
      const isVisible = await h.isVisible();
      if (isVisible && text) console.log(`  Heading: "${text}"`);
    }

    // =========================================================
    // B. SETTINGS — TEAMS INVESTIGATION
    // =========================================================
    console.log('\n=== B. SETTINGS — TEAMS DEEP DIVE ===');
    await page.goto(`${BASE_URL}/settings`);
    await wait(2000);

    // Find teams tab
    const teamsTabBtn = page.locator('button:has-text("Teams"), [role="tab"]:has-text("Teams")').first();
    if (await teamsTabBtn.isVisible()) {
      await teamsTabBtn.click();
      await wait(2000);
    }
    await ss(page, 'B01-teams-full');

    // Get all text content from teams area
    const teamsTableText = await page.locator('table, [class*="table"], [class*="list"]').first().textContent().catch(() => 'no table found');
    console.log(`  Teams table content: ${teamsTableText?.substring(0, 500)}`);

    // Count all team rows
    const teamRows = await page.locator('tbody tr').all();
    console.log(`  Total team rows in table: ${teamRows.length}`);
    for (const row of teamRows) {
      const text = (await row.textContent())?.trim();
      if (text) console.log(`    Row: "${text.substring(0, 100)}"`);
    }

    // Check for Facility Maintenance specifically
    const facilityText = await page.locator('text=/Facility|Maintenance/i').count();
    console.log(`  "Facility/Maintenance" text occurrences: ${facilityText}`);

    // Check Security team
    const securityText = await page.locator('text=/Security/i').count();
    console.log(`  "Security" text occurrences: ${securityText}`);

    // =========================================================
    // C. MEMBERS — ROLE DROPDOWN INVESTIGATION
    // =========================================================
    console.log('\n=== C. MEMBERS — INVITE ROLE DROPDOWN ===');
    await page.goto(`${BASE_URL}/settings`);
    await wait(2000);
    const membersTabBtn = page.locator('button:has-text("Members"), [role="tab"]:has-text("Members")').first();
    if (await membersTabBtn.isVisible()) {
      await membersTabBtn.click();
      await wait(2000);
    }

    const inviteBtn = page.locator('button:has-text("Invite")').first();
    if (await inviteBtn.isVisible()) {
      await inviteBtn.click();
      await wait(1000);
      await ss(page, 'C01-invite-dialog');

      // Get all form elements in dialog
      const dialogEl = page.locator('[role="dialog"]').first();
      if (await dialogEl.isVisible()) {
        const selects = await dialogEl.locator('select, [role="combobox"], [role="listbox"]').all();
        console.log(`  Dialog has ${selects.length} select/combobox elements`);

        for (const sel of selects) {
          const selText = await sel.textContent();
          const selType = await sel.getAttribute('role');
          console.log(`  Dropdown (${selType}): "${selText?.substring(0, 200)}"`);
        }

        // Check for role select specifically
        const roleSelect = dialogEl.locator('select[name*="role"]');
        if (await roleSelect.count() > 0) {
          const options = await roleSelect.locator('option').all();
          console.log(`  Role select options:`);
          for (const opt of options) {
            const optText = await opt.textContent();
            console.log(`    - ${optText}`);
          }
        }

        // Fill in invite form to see all fields
        const emailInput = dialogEl.locator('input[type="email"]').first();
        if (await emailInput.isVisible()) {
          await emailInput.fill('test@example.com');
          await wait(500);
          await ss(page, 'C02-invite-filled');
        }
      }
      await page.keyboard.press('Escape');
      await wait(500);
    }

    // =========================================================
    // D. CALENDAR — CAMPUS PICKER INVESTIGATION
    // =========================================================
    console.log('\n=== D. CALENDAR — CAMPUS PICKER ===');
    await page.goto(`${BASE_URL}/calendar`);
    await wait(3000);
    await ss(page, 'D01-calendar-full');

    // Look at ALL visible elements in header/toolbar
    const calHeader = await page.locator('header, [class*="header"], [class*="toolbar"], [class*="controls"]').all();
    console.log(`  Calendar header/toolbar elements: ${calHeader.length}`);

    // Find all selects and dropdowns
    const allSelects = await page.locator('select, [role="combobox"], [role="listbox"]').all();
    console.log(`  All selects/comboboxes on calendar page: ${allSelects.length}`);
    for (const sel of allSelects) {
      const text = await sel.textContent();
      const placeholder = await sel.getAttribute('placeholder');
      console.log(`  Select: "${text?.substring(0, 100)}" placeholder: "${placeholder}"`);
    }

    // Look for campus-related text anywhere on the page
    const campusText = await page.locator('text=/campus/i').count();
    console.log(`  "campus" text occurrences on calendar: ${campusText}`);

    // Get full page text to find campus picker location
    const sidebar = await page.locator('aside, [class*="sidebar"]').first().textContent().catch(() => '');
    console.log(`  Sidebar text preview: "${sidebar?.substring(0, 300)}"`);

    // =========================================================
    // E. NOTIFICATIONS — DEEPER INVESTIGATION
    // =========================================================
    console.log('\n=== E. NOTIFICATIONS INVESTIGATION ===');
    await page.goto(`${BASE_URL}/dashboard`);
    await wait(2000);
    await ss(page, 'E01-dashboard-header');

    // Find header area elements
    const headerEl = page.locator('header').first();
    if (await headerEl.isVisible()) {
      const headerButtons = await headerEl.locator('button').all();
      console.log(`  Header has ${headerButtons.length} buttons`);
      for (const btn of headerButtons) {
        const text = await btn.textContent();
        const ariaLabel = await btn.getAttribute('aria-label');
        const title = await btn.getAttribute('title');
        console.log(`    Button: text="${text?.trim().substring(0, 30)}" aria="${ariaLabel}" title="${title}"`);
      }
    }

    // Try to click notification-related buttons
    const notifButtons = await page.locator('[class*="bell"], [class*="notif"], [aria-label*="notif"], [aria-label*="bell"]').all();
    console.log(`  Notification-related buttons: ${notifButtons.length}`);

    if (notifButtons.length > 0) {
      await notifButtons[0].click();
      await wait(1000);
      await ss(page, 'E02-notification-clicked');

      // Check what appeared
      const newElements = await page.locator('[class*="popover"], [class*="dropdown"], [class*="panel"], [role="dialog"]').all();
      console.log(`  After click, popover/panel elements visible: ${newElements.length}`);
      for (const el of newElements) {
        const isVis = await el.isVisible();
        if (isVis) {
          const text = await el.textContent();
          console.log(`    Visible panel text: "${text?.substring(0, 200)}"`);
        }
      }
    }

    // =========================================================
    // F. ATHLETICS — CAMPUS PICKER INVESTIGATION
    // =========================================================
    console.log('\n=== F. ATHLETICS — CAMPUS PICKER INVESTIGATION ===');
    await page.goto(`${BASE_URL}/athletics`);
    await wait(3000);
    await ss(page, 'F01-athletics-full');

    // Check sidebar for campus picker
    const sidebarText = await page.locator('aside, [class*="sidebar"]').first().textContent().catch(() => '');
    console.log(`  Athletics sidebar: "${sidebarText?.substring(0, 400)}"`);

    // Check for any school/campus selector
    const campusSelectors = await page.locator('[class*="campus"], [class*="school"], [class*="location"]').all();
    console.log(`  Campus-related elements: ${campusSelectors.length}`);
    for (const sel of campusSelectors) {
      const text = await sel.textContent();
      console.log(`    Element: "${text?.substring(0, 100)}"`);
    }

    // Look at the content area for campus selector context
    const mainContent = await page.locator('main, [class*="main"], [class*="content"]').first().textContent().catch(() => '');
    console.log(`  Main content preview: "${mainContent?.substring(0, 400)}"`);

    // =========================================================
    // G. ATHLETICS — CRUD OPERATIONS
    // =========================================================
    console.log('\n=== G. ATHLETICS — CRUD OPERATIONS ===');
    await page.goto(`${BASE_URL}/athletics`);
    await wait(2000);

    // Sports tab
    const sportsTab = page.locator('button:has-text("Sports"), [role="tab"]:has-text("Sports")').first();
    if (await sportsTab.isVisible()) {
      await sportsTab.click();
      await wait(1500);
      await ss(page, 'G01-athletics-sports');

      // Try adding a sport
      const addSportBtn = page.locator('button:has-text("Add Sport"), button:has-text("Create Sport"), button:has-text("New Sport"), button:has-text("Add")').first();
      if (await addSportBtn.isVisible()) {
        log('athletics/sports', 'OK', 'Add Sport button visible', '');
        await addSportBtn.click();
        await wait(1000);
        await ss(page, 'G02-sports-add-dialog');
        const dialog = page.locator('[role="dialog"]').first();
        if (await dialog.isVisible()) {
          log('athletics/sports', 'OK', 'Add Sport dialog opens', '');
          const dialogContent = await dialog.textContent();
          console.log(`    Add sport dialog content: "${dialogContent?.substring(0, 300)}"`);
        }
        await page.keyboard.press('Escape');
        await wait(500);
      } else {
        log('athletics/sports', 'UX', 'No Add Sport button found', 'Need a way to create sports');
      }

      // Check for existing sports
      const sportRows = await page.locator('tbody tr, [class*="sport-item"], [class*="SportItem"]').count();
      console.log(`  Sports list has ${sportRows} items`);
    }

    // Teams tab
    const teamsTab2 = page.locator('button:has-text("Teams"), [role="tab"]:has-text("Teams")').first();
    if (await teamsTab2.isVisible()) {
      await teamsTab2.click();
      await wait(1500);
      await ss(page, 'G03-athletics-teams');

      const teamRows = await page.locator('tbody tr, [class*="team-row"]').count();
      console.log(`  Athletics teams list has ${teamRows} items`);
    }

    // Tournaments tab
    const tournamentsTab = page.locator('button:has-text("Tournaments"), [role="tab"]:has-text("Tournaments")').first();
    if (await tournamentsTab.isVisible()) {
      await tournamentsTab.click();
      await wait(1500);
      await ss(page, 'G04-athletics-tournaments');

      const addTournamentBtn = page.locator('button:has-text("Create Tournament"), button:has-text("New Tournament"), button:has-text("Add Tournament")').first();
      if (await addTournamentBtn.isVisible()) {
        log('athletics/tournaments', 'OK', 'Create Tournament button visible', '');
      }
    }

    // =========================================================
    // H. CALENDAR — CREATE EVENT FLOW
    // =========================================================
    console.log('\n=== H. CALENDAR — CREATE EVENT INVESTIGATION ===');
    await page.goto(`${BASE_URL}/calendar`);
    await wait(3000);

    // Look for ALL buttons on calendar page
    const calButtons = await page.locator('button').all();
    console.log(`  Calendar page has ${calButtons.length} buttons`);
    const calButtonTexts = [];
    for (const btn of calButtons) {
      const text = (await btn.textContent())?.trim();
      const isVis = await btn.isVisible();
      if (isVis && text && text.length < 50) calButtonTexts.push(`"${text}"`);
    }
    console.log(`  Button labels: ${calButtonTexts.join(', ')}`);

    // Try clicking on a day cell to create event
    const dayCell = page.locator('[class*="day"], [class*="cell"], td').first();
    if (await dayCell.isVisible()) {
      await dayCell.click();
      await wait(1000);
      await ss(page, 'H01-calendar-day-click');
      const createModal = page.locator('[role="dialog"]').first();
      if (await createModal.isVisible()) {
        log('calendar', 'OK', 'Clicking day cell opens create event dialog', '');
        await ss(page, 'H02-calendar-create-event-modal');
        const modalContent = await createModal.textContent();
        console.log(`  Create event modal content: "${modalContent?.substring(0, 400)}"`);

        // Try to fill in and submit
        const titleInput = createModal.locator('input[name*="title"], input[placeholder*="title"], input[placeholder*="Title"]').first();
        if (await titleInput.isVisible()) {
          await titleInput.fill('QA Test Event');
          log('calendar', 'OK', 'Event title input works', '');
        }
        await page.keyboard.press('Escape');
        await wait(500);
      }
    }

    // =========================================================
    // I. CAMPUS SETTINGS — DEEP INVESTIGATION
    // =========================================================
    console.log('\n=== I. CAMPUS SETTINGS — HIERARCHY CHECK ===');
    await page.goto(`${BASE_URL}/settings`);
    await wait(2000);
    const campusTab = page.locator('button:has-text("Campus"), [role="tab"]:has-text("Campus")').first();
    if (await campusTab.isVisible()) {
      await campusTab.click();
      await wait(2000);
      await ss(page, 'I01-campus-full');

      // Get full table HTML to understand structure
      const tableHtml = await page.locator('table').first().innerHTML().catch(() => 'no table');
      console.log(`  Campus table HTML (first 1000 chars):`);
      console.log(`    ${tableHtml.substring(0, 1000)}`);

      // Check for division/building hierarchy
      const buildingHeaders = await page.locator('[class*="division"], [class*="header-row"], th').all();
      console.log(`  Building/division header elements: ${buildingHeaders.length}`);

      // Count actual table rows and their indentation
      const rows = await page.locator('tbody tr').all();
      console.log(`  Campus rows (${rows.length} total):`);
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const text = (await rows[i].textContent())?.trim();
        const classList = await rows[i].getAttribute('class');
        console.log(`    Row ${i+1}: class="${classList?.substring(0, 80)}" text="${text?.substring(0, 80)}"`);
      }
    }

    // =========================================================
    // J. ROLES — TEACHER ROLE PERMISSIONS CHECK
    // =========================================================
    console.log('\n=== J. ROLES — PERMISSIONS CHECK ===');
    await page.goto(`${BASE_URL}/settings`);
    await wait(2000);
    const rolesTab = page.locator('button:has-text("Roles"), [role="tab"]:has-text("Roles")').first();
    if (await rolesTab.isVisible()) {
      await rolesTab.click();
      await wait(2000);

      // Click on Teacher role to view permissions
      const teacherRow = page.locator('tr:has-text("Teacher"), [class*="role"]:has-text("Teacher")').first();
      if (await teacherRow.isVisible()) {
        await teacherRow.click();
        await wait(1000);
        await ss(page, 'J01-teacher-role-detail');
        const detail = page.locator('[role="dialog"], [class*="detail"], [class*="drawer"]').first();
        if (await detail.isVisible()) {
          log('settings/roles', 'OK', 'Teacher role detail/permissions view opens', '');
          const detailContent = await detail.textContent();
          console.log(`  Teacher role detail content: "${detailContent?.substring(0, 400)}"`);
          await page.keyboard.press('Escape');
          await wait(500);
        }
      }

      // Check system badge is only on system roles (not Teacher which is new)
      const teacherBadge = await page.locator('tr:has-text("Teacher") [class*="badge"]:has-text("System")').count();
      console.log(`  Teacher row has System badge: ${teacherBadge > 0}`);
    }

    // =========================================================
    // K. DASHBOARD — FULL WIDGET INSPECTION
    // =========================================================
    console.log('\n=== K. DASHBOARD — WIDGETS INSPECTION ===');
    await page.goto(`${BASE_URL}/dashboard`);
    await wait(4000);
    await ss(page, 'K01-dashboard-full');

    // Get all card/widget elements
    const widgets = await page.locator('[class*="card"], [class*="Card"], [class*="widget"], [class*="Widget"]').all();
    console.log(`  Dashboard widgets found: ${widgets.length}`);
    for (const w of widgets) {
      const isVis = await w.isVisible();
      if (isVis) {
        const text = await w.textContent();
        console.log(`    Widget: "${text?.substring(0, 100)}"`);
      }
    }

    // Check for any quick action buttons
    const quickActions = await page.locator('button, a[class*="action"]').all();
    const qaTexts = [];
    for (const qa of quickActions) {
      const text = (await qa.textContent())?.trim();
      const isVis = await qa.isVisible();
      if (isVis && text && text.length < 40) qaTexts.push(`"${text}"`);
    }
    console.log(`  Quick action elements: ${qaTexts.join(', ')}`);

    // =========================================================
    // L. SETTINGS — APPROVAL CONFIG AND SCHOOLS
    // =========================================================
    console.log('\n=== L. OTHER SETTINGS TABS ===');
    await page.goto(`${BASE_URL}/settings`);
    await wait(2000);

    const allSettingsTabs = await page.locator('[role="tab"], [class*="tab-btn"]').all();
    console.log(`  All settings tabs:`);
    for (const tab of allSettingsTabs) {
      const text = (await tab.textContent())?.trim();
      const isVis = await tab.isVisible();
      if (isVis && text) console.log(`    - "${text}"`);
    }

    // Try each remaining tab
    const tabsToTest = ['Schools', 'Approval', 'Bell Schedule', 'Principals'];
    for (const tabName of tabsToTest) {
      const tab = page.locator(`button:has-text("${tabName}"), [role="tab"]:has-text("${tabName}")`).first();
      if (await tab.isVisible()) {
        await tab.click();
        await wait(1500);
        await ss(page, `L-settings-${tabName.toLowerCase().replace(' ', '-')}`);
        log('settings', 'OK', `"${tabName}" settings tab accessible`, '');

        // Check for content
        const mainArea = page.locator('main, [class*="content"]').first();
        const content = await mainArea.textContent().catch(() => '');
        console.log(`  ${tabName} content: "${content?.substring(0, 200)}"`);
      } else {
        log('settings', 'UX', `"${tabName}" tab not found in settings`, 'Expected settings tab missing');
      }
    }

    // =========================================================
    // M. SIDEBAR NAVIGATION — COMPLETE AUDIT
    // =========================================================
    console.log('\n=== M. SIDEBAR NAVIGATION AUDIT ===');
    await page.goto(`${BASE_URL}/dashboard`);
    await wait(2000);

    const sidebarNav = await page.locator('aside a, aside button, [class*="sidebar"] a, [class*="sidebar"] button').all();
    console.log(`  Sidebar navigation items: ${sidebarNav.length}`);
    const navItems = [];
    for (const item of sidebarNav) {
      const text = (await item.textContent())?.trim();
      const href = await item.getAttribute('href');
      const isVis = await item.isVisible();
      if (isVis && text) navItems.push({ text, href });
    }
    navItems.forEach(n => console.log(`  Nav: "${n.text}" -> ${n.href}`));

    // Test each nav link
    for (const navItem of navItems.slice(0, 10)) {
      if (navItem.href && !navItem.href.startsWith('#')) {
        const fullUrl = navItem.href.startsWith('http') ? navItem.href : `${BASE_URL}${navItem.href}`;
        await page.goto(fullUrl);
        await wait(2000);
        const finalUrl = page.url();
        const is404 = await page.locator('text="404", text="Not Found", text="Page not found"').count();
        if (is404 > 0) {
          log('sidebar', 'BUG', `Sidebar link "${navItem.text}" leads to 404`, `URL: ${fullUrl}`);
        } else {
          log('sidebar', 'OK', `Sidebar link "${navItem.text}" works`, `${finalUrl}`);
        }
      }
    }

    // =========================================================
    // N. GLOBAL SEARCH — TEST CONTENT
    // =========================================================
    console.log('\n=== N. GLOBAL SEARCH — CONTENT TEST ===');
    await page.goto(`${BASE_URL}/dashboard`);
    await wait(2000);
    await page.keyboard.press('Meta+k');
    await wait(1000);
    await ss(page, 'N01-search-open');

    const searchInput = page.locator('[role="dialog"] input, [class*="command"] input').first();
    if (await searchInput.isVisible()) {
      // Test various searches
      const searches = ['linfield', 'event', 'building', 'user'];
      for (const query of searches) {
        await searchInput.clear();
        await searchInput.type(query);
        await wait(800);
        await ss(page, `N-search-${query}`);
        const resultCount = await page.locator('[role="option"], [class*="result-item"]').count();
        console.log(`  Search "${query}": ${resultCount} results`);
      }
    }
    await page.keyboard.press('Escape');
    await wait(500);

    // =========================================================
    // O. RESPONSIVE CHECK — MOBILE
    // =========================================================
    console.log('\n=== O. RESPONSIVE / MOBILE CHECK ===');
    await ctx.close();
    const mobileCtx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const mobilePage = await mobileCtx.newPage();

    await mobilePage.goto(`${BASE_URL}/login`);
    await wait(1500);
    await mobilePage.locator('input[type="email"]').fill(EMAIL);
    await mobilePage.locator('input[type="password"]').fill(PASSWORD);
    await mobilePage.keyboard.press('Enter');
    await wait(3000);

    await mobilePage.goto(`${BASE_URL}/dashboard`);
    await wait(2000);
    await mobilePage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'O01-mobile-dashboard.png'), fullPage: true });
    console.log('  [SS] O01-mobile-dashboard.png');

    // Check if sidebar is collapsed/hamburger on mobile
    const hamburger = mobilePage.locator('[class*="hamburger"], [aria-label*="menu"], [aria-label*="Menu"], button[class*="menu"]').first();
    if (await hamburger.isVisible()) {
      log('mobile', 'OK', 'Hamburger menu visible on mobile', '');
    } else {
      // Check if sidebar is just hidden or visible
      const mobileSidebar = mobilePage.locator('aside, [class*="sidebar"]').first();
      const sidebarVis = await mobileSidebar.isVisible().catch(() => false);
      if (!sidebarVis) {
        log('mobile', 'UX', 'Sidebar hidden on mobile but no hamburger menu visible', 'Users cannot access navigation on mobile');
      } else {
        log('mobile', 'UX', 'Sidebar still visible on mobile (may overflow)', 'Sidebar should collapse on mobile viewports');
      }
    }

    await mobilePage.goto(`${BASE_URL}/settings`);
    await wait(2000);
    await mobilePage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'O02-mobile-settings.png'), fullPage: true });
    console.log('  [SS] O02-mobile-settings.png');
    await mobileCtx.close();

  } catch (err) {
    console.error('\nTest error:', err.message);
    console.error(err.stack);
  } finally {
    await browser.close();
  }

  // Final report
  console.log('\n\n=== DEEP TEST FINDINGS ===');
  const bugs = findings.filter(f => f.severity === 'BUG');
  const uxIssues = findings.filter(f => f.severity === 'UX');
  const oks = findings.filter(f => f.severity === 'OK');

  console.log(`Bugs: ${bugs.length}, UX Issues: ${uxIssues.length}, OK: ${oks.length}`);
  bugs.forEach(b => console.log(`  BUG [${b.category}] ${b.title}: ${b.details}`));
  uxIssues.forEach(u => console.log(`  UX [${u.category}] ${u.title}: ${u.details}`));

  // Console errors summary
  console.log(`\nConsole errors collected: ${consoleErrors?.length ?? 0}`);
}

run().catch(console.error);
