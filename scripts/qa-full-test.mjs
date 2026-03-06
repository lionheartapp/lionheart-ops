/**
 * Comprehensive QA Test — Lionheart Platform
 * Super Admin full walkthrough of every page and interaction
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://linfield-christian-school.lionheartapp.com';
const EMAIL = 'mkerley@linfield.com';
const PASSWORD = 'TestLionheart2024!';
const SCREENSHOTS_DIR = path.join(process.cwd(), 'scripts/qa-test-screenshots');

const findings = {
  bugs: [],
  uxIssues: [],
  working: [],
  info: []
};

function bug(severity, title, description, page = '') {
  findings.bugs.push({ severity, title, description, page });
  console.log(`  [BUG-${severity}] ${title}: ${description}`);
}

function ux(title, description, page = '') {
  findings.uxIssues.push({ title, description, page });
  console.log(`  [UX] ${title}: ${description}`);
}

function ok(title, page = '') {
  findings.working.push({ title, page });
  console.log(`  [OK] ${title}`);
}

function info(msg) {
  findings.info.push(msg);
  console.log(`  [INFO] ${msg}`);
}

async function screenshot(page, name) {
  const filepath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`  [SCREENSHOT] ${name}.png`);
  return filepath;
}

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  // Collect console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  try {
    // =========================================================
    // 1. LOGIN FLOW
    // =========================================================
    console.log('\n=== 1. LOGIN FLOW ===');
    await page.goto(`${BASE_URL}/login`);
    await wait(2000);
    await screenshot(page, '01-login-page');

    // Check login page elements
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    if (await emailInput.isVisible()) {
      ok('Login page renders correctly with email/password fields', 'login');
    } else {
      bug('HIGH', 'Login form missing email field', 'Email input not visible on login page', 'login');
    }

    await emailInput.fill(EMAIL);
    await passwordInput.fill(PASSWORD);
    await screenshot(page, '01b-login-filled');

    await page.keyboard.press('Enter');
    await wait(3000);

    const currentUrl = page.url();
    if (currentUrl.includes('/dashboard') || currentUrl.includes('/calendar') || (!currentUrl.includes('/login'))) {
      ok('Login successful - redirected away from login page', 'login');
    } else {
      bug('CRITICAL', 'Login failed', `Still on login page after submission. URL: ${currentUrl}`, 'login');
    }

    await screenshot(page, '02-post-login');

    // =========================================================
    // 2. DASHBOARD
    // =========================================================
    console.log('\n=== 2. DASHBOARD ===');
    await page.goto(`${BASE_URL}/dashboard`);
    await wait(3000);
    await screenshot(page, '03-dashboard');

    // Check sidebar exists
    const sidebar = page.locator('nav, aside, [class*="sidebar"]').first();
    if (await sidebar.isVisible()) {
      ok('Sidebar navigation visible', 'dashboard');
    } else {
      bug('HIGH', 'Sidebar not visible on dashboard', 'Navigation sidebar missing', 'dashboard');
    }

    // Check for dashboard widgets
    const cards = await page.locator('[class*="card"], [class*="widget"], [class*="stat"]').count();
    info(`Dashboard has ${cards} card/widget elements`);

    // Check for skeleton loaders (should resolve)
    await wait(2000);
    const skeletons = await page.locator('[class*="skeleton"], [class*="animate-pulse"]').count();
    if (skeletons > 0) {
      bug('MEDIUM', 'Dashboard still showing skeleton loaders after 5s', `${skeletons} skeleton elements still visible`, 'dashboard');
    } else {
      ok('Dashboard content loaded (no lingering skeletons)', 'dashboard');
    }

    // =========================================================
    // 3. CALENDAR
    // =========================================================
    console.log('\n=== 3. CALENDAR ===');
    const calendarLink = page.locator('a[href*="calendar"], [data-testid*="calendar"]').first();
    if (await calendarLink.isVisible()) {
      await calendarLink.click();
    } else {
      await page.goto(`${BASE_URL}/calendar`);
    }
    await wait(3000);
    await screenshot(page, '04-calendar');

    const calUrl = page.url();
    if (calUrl.includes('calendar')) {
      ok('Calendar page navigates correctly', 'calendar');
    }

    // Check campus picker
    const campusPicker = page.locator('[class*="campus"], select, [role="combobox"]').first();
    if (await campusPicker.isVisible()) {
      ok('Campus picker visible on calendar', 'calendar');
    } else {
      bug('MEDIUM', 'Campus picker not visible on calendar', 'No campus selector found on calendar page', 'calendar');
    }

    // Check calendar views (month/week/day)
    const viewButtons = await page.locator('button:has-text("Month"), button:has-text("Week"), button:has-text("Day")').all();
    if (viewButtons.length >= 2) {
      ok(`Calendar view buttons present (${viewButtons.length} found)`, 'calendar');
      // Click Week view
      for (const btn of viewButtons) {
        const text = await btn.textContent();
        if (text?.includes('Week')) {
          await btn.click();
          await wait(1500);
          await screenshot(page, '04b-calendar-week');
          ok('Calendar week view works', 'calendar');
          break;
        }
      }
    } else {
      bug('MEDIUM', 'Calendar view buttons missing', 'Month/Week/Day view buttons not found', 'calendar');
    }

    // Try creating a calendar event
    const addEventBtn = page.locator('button:has-text("Add"), button:has-text("New"), button:has-text("Create"), button:has-text("+")').first();
    if (await addEventBtn.isVisible()) {
      await addEventBtn.click();
      await wait(1500);
      await screenshot(page, '04c-calendar-new-event');
      const modal = page.locator('[role="dialog"], [class*="modal"], [class*="drawer"]').first();
      if (await modal.isVisible()) {
        ok('New event dialog/modal opens', 'calendar');
        await page.keyboard.press('Escape');
        await wait(500);
      } else {
        bug('MEDIUM', 'New event button clicked but no modal appeared', 'Add event modal did not open', 'calendar');
      }
    } else {
      ux('No visible "Add Event" button on calendar', 'Consider adding a prominent CTA button', 'calendar');
    }

    // Check sidebar calendar list
    const calendarSidebarItems = await page.locator('[class*="calendar-list"], [class*="CalendarList"], aside li').count();
    info(`Calendar sidebar has ${calendarSidebarItems} items`);

    // =========================================================
    // 4. ATHLETICS
    // =========================================================
    console.log('\n=== 4. ATHLETICS ===');
    const athleticsLink = page.locator('a[href*="athletics"]').first();
    if (await athleticsLink.isVisible()) {
      await athleticsLink.click();
    } else {
      await page.goto(`${BASE_URL}/athletics`);
    }
    await wait(3000);
    await screenshot(page, '05-athletics');

    const athUrl = page.url();
    if (athUrl.includes('athletics')) {
      ok('Athletics page navigates correctly', 'athletics');
    }

    // CRITICAL BUG CHECK: Campus picker loading
    await wait(2000);
    const athCampusPicker = page.locator('[class*="campus"], [placeholder*="campus"], [placeholder*="Campus"]').first();
    const athSelectElements = await page.locator('select, [role="combobox"], [role="listbox"]').all();
    info(`Athletics page has ${athSelectElements.length} select/combobox elements`);

    // Check for athletics sub-tabs
    const subTabs = ['Sports', 'Teams', 'Schedule', 'Roster', 'Tournaments', 'Stats'];
    for (const tabName of subTabs) {
      const tab = page.locator(`button:has-text("${tabName}"), [role="tab"]:has-text("${tabName}"), a:has-text("${tabName}")`).first();
      if (await tab.isVisible()) {
        await tab.click();
        await wait(1500);
        await screenshot(page, `05-athletics-${tabName.toLowerCase()}`);
        ok(`Athletics ${tabName} tab visible and clickable`, 'athletics');

        // Check for empty states or loading issues
        const tabSkeletons = await page.locator('[class*="skeleton"], [class*="animate-pulse"]').count();
        if (tabSkeletons > 0) {
          await wait(2000);
          const tabSkeletons2 = await page.locator('[class*="skeleton"], [class*="animate-pulse"]').count();
          if (tabSkeletons2 > 0) {
            bug('MEDIUM', `Athletics ${tabName} tab stuck in loading state`, `${tabSkeletons2} skeleton elements still visible after 3.5s`, 'athletics');
          }
        }
      } else {
        bug('MEDIUM', `Athletics ${tabName} tab not visible`, `Cannot find tab button for ${tabName}`, 'athletics');
      }
    }

    // =========================================================
    // 5. SETTINGS
    // =========================================================
    console.log('\n=== 5. SETTINGS ===');
    const settingsLink = page.locator('a[href*="settings"]').first();
    if (await settingsLink.isVisible()) {
      await settingsLink.click();
    } else {
      await page.goto(`${BASE_URL}/settings`);
    }
    await wait(3000);
    await screenshot(page, '06-settings');

    // --- 5a. My Profile Tab ---
    console.log('\n  --- 5a. My Profile ---');
    const profileTab = page.locator('button:has-text("My Profile"), [role="tab"]:has-text("My Profile"), a:has-text("My Profile")').first();
    if (await profileTab.isVisible()) {
      await profileTab.click();
      await wait(1500);
      await screenshot(page, '06a-settings-profile');
      ok('My Profile tab accessible', 'settings/profile');

      // Check for name edit fields
      const nameInput = page.locator('input[name*="name"], input[placeholder*="name"], input[placeholder*="Name"]').first();
      if (await nameInput.isVisible()) {
        ok('Name field visible in profile', 'settings/profile');
      } else {
        ux('No visible name edit field in My Profile', 'Add editable name input field', 'settings/profile');
      }

      // Check for avatar/image upload
      const avatarBtn = page.locator('button:has-text("Upload"), button:has-text("Change"), input[type="file"]').first();
      if (await avatarBtn.isVisible()) {
        ok('Avatar/image change option available', 'settings/profile');
      } else {
        ux('No avatar upload button visible', 'Consider adding profile photo upload', 'settings/profile');
      }

      // Check for change password
      const changePasswordBtn = page.locator('button:has-text("Change Password"), button:has-text("Password")').first();
      if (await changePasswordBtn.isVisible()) {
        ok('Change Password button visible', 'settings/profile');
        await changePasswordBtn.click();
        await wait(1000);
        await screenshot(page, '06a-profile-change-password');
        const pwDrawer = page.locator('[role="dialog"], [class*="drawer"], [class*="modal"]').first();
        if (await pwDrawer.isVisible()) {
          ok('Change password drawer/modal opens', 'settings/profile');
          await page.keyboard.press('Escape');
          await wait(500);
        }
      }
    } else {
      bug('HIGH', 'My Profile tab not found in settings', 'Cannot find profile tab', 'settings');
    }

    // --- 5b. School Information Tab ---
    console.log('\n  --- 5b. School Information ---');
    const schoolInfoTab = page.locator('button:has-text("School Info"), [role="tab"]:has-text("School Info"), a:has-text("School Info"), button:has-text("School Information"), a:has-text("School Information")').first();
    if (await schoolInfoTab.isVisible()) {
      await schoolInfoTab.click();
      await wait(1500);
      await screenshot(page, '06b-settings-school-info');
      ok('School Information tab accessible', 'settings/school-info');

      const orgNameInput = page.locator('input[name*="name"], input[placeholder*="organization"], input[placeholder*="school"]').first();
      if (await orgNameInput.isVisible()) {
        ok('Organization name field visible', 'settings/school-info');
      }
    } else {
      bug('MEDIUM', 'School Information tab not found', 'Cannot locate school info tab in settings', 'settings');
    }

    // --- 5c. Roles Tab ---
    console.log('\n  --- 5c. Roles ---');
    const rolesTab = page.locator('button:has-text("Roles"), [role="tab"]:has-text("Roles"), a:has-text("Roles")').first();
    if (await rolesTab.isVisible()) {
      await rolesTab.click();
      await wait(2000);
      await screenshot(page, '06c-settings-roles');
      ok('Roles tab accessible', 'settings/roles');

      // Check expected roles
      const expectedRoles = ['Super Admin', 'Administrator', 'Teacher', 'Member', 'Viewer'];
      for (const roleName of expectedRoles) {
        const roleEl = page.locator(`text="${roleName}"`).first();
        if (await roleEl.isVisible()) {
          ok(`Role "${roleName}" visible in roles list`, 'settings/roles');
        } else {
          bug('HIGH', `Role "${roleName}" missing from roles list`, `Expected to see ${roleName} in the roles table`, 'settings/roles');
        }
      }

      // Check for "System" badge on system roles
      const systemBadges = await page.locator('text="System"').count();
      if (systemBadges > 0) {
        ok(`System badge present on ${systemBadges} role(s)`, 'settings/roles');
      } else {
        bug('MEDIUM', 'No "System" badge visible on system roles', 'System roles should have a "System" badge indicator', 'settings/roles');
      }

      // Try creating a custom role
      const createRoleBtn = page.locator('button:has-text("Create"), button:has-text("Add Role"), button:has-text("New Role")').first();
      if (await createRoleBtn.isVisible()) {
        await createRoleBtn.click();
        await wait(1000);
        await screenshot(page, '06c-roles-create-dialog');
        const roleDialog = page.locator('[role="dialog"], [class*="modal"], [class*="drawer"]').first();
        if (await roleDialog.isVisible()) {
          ok('Create role dialog opens', 'settings/roles');
          await page.keyboard.press('Escape');
          await wait(500);
        }
      }
    } else {
      bug('HIGH', 'Roles tab not found in settings', 'Cannot locate roles tab', 'settings');
    }

    // --- 5d. Teams Tab ---
    console.log('\n  --- 5d. Teams ---');
    const teamsTab = page.locator('button:has-text("Teams"), [role="tab"]:has-text("Teams"), a:has-text("Teams")').first();
    if (await teamsTab.isVisible()) {
      await teamsTab.click();
      await wait(2000);
      await screenshot(page, '06d-settings-teams');
      ok('Teams tab accessible', 'settings/teams');

      // Check expected teams
      const expectedTeams = ['IT Support', 'Maintenance', 'A/V Production', 'Administration'];
      for (const teamName of expectedTeams) {
        const teamEl = page.locator(`text="${teamName}"`).first();
        if (await teamEl.isVisible()) {
          ok(`Team "${teamName}" visible in teams list`, 'settings/teams');
        } else {
          bug('HIGH', `Team "${teamName}" missing from teams list`, `Expected to see ${teamName} in the teams table`, 'settings/teams');
        }
      }

      // Check for Type column/badges
      const typeBadges = await page.locator('[class*="badge"], [class*="tag"], [class*="chip"]').count();
      if (typeBadges > 0) {
        ok(`Team type badges present (${typeBadges} found)`, 'settings/teams');
      } else {
        ux('No team type badges visible', 'Teams should show type badges', 'settings/teams');
      }

      // Test create team
      const createTeamBtn = page.locator('button:has-text("Create Team"), button:has-text("Add Team"), button:has-text("New Team"), button:has-text("Create")').first();
      if (await createTeamBtn.isVisible()) {
        await createTeamBtn.click();
        await wait(1000);
        await screenshot(page, '06d-teams-create-dialog');
        const teamDialog = page.locator('[role="dialog"], [class*="modal"], [class*="drawer"]').first();
        if (await teamDialog.isVisible()) {
          ok('Create team dialog opens', 'settings/teams');

          // Check for type dropdown in create form
          const typeDropdown = page.locator('select[name*="type"], [name*="type"], [placeholder*="type"], [placeholder*="Type"]').first();
          if (await typeDropdown.isVisible()) {
            ok('Team type dropdown present in create form', 'settings/teams');
          } else {
            bug('MEDIUM', 'Team type dropdown missing in create team form', 'Cannot set team type when creating team', 'settings/teams');
          }

          await page.keyboard.press('Escape');
          await wait(500);
        }
      }
    } else {
      bug('HIGH', 'Teams tab not found in settings', 'Cannot locate teams tab', 'settings');
    }

    // --- 5e. Members Tab ---
    console.log('\n  --- 5e. Members ---');
    const membersTab = page.locator('button:has-text("Members"), [role="tab"]:has-text("Members"), a:has-text("Members")').first();
    if (await membersTab.isVisible()) {
      await membersTab.click();
      await wait(2000);
      await screenshot(page, '06e-settings-members');
      ok('Members tab accessible', 'settings/members');

      // Check member list
      const memberRows = await page.locator('tbody tr, [class*="member-row"], [class*="user-row"]').count();
      info(`Members list has ${memberRows} member rows visible`);

      if (memberRows > 0) {
        ok('Members list populated', 'settings/members');
      } else {
        bug('MEDIUM', 'Members list appears empty', 'No member rows found in members table', 'settings/members');
      }

      // Check for invite button
      const inviteBtn = page.locator('button:has-text("Invite"), button:has-text("Add Member")').first();
      if (await inviteBtn.isVisible()) {
        ok('Invite member button visible', 'settings/members');
        await inviteBtn.click();
        await wait(1000);
        await screenshot(page, '06e-members-invite-dialog');
        const inviteDialog = page.locator('[role="dialog"], [class*="modal"], [class*="drawer"]').first();
        if (await inviteDialog.isVisible()) {
          ok('Invite member dialog opens', 'settings/members');

          // Check for role dropdown with Teacher role
          const roleDropdown = page.locator('select, [role="combobox"]').last();
          if (await roleDropdown.isVisible()) {
            const dropdownText = await roleDropdown.textContent();
            info(`Role dropdown content: ${dropdownText?.substring(0, 100)}`);
          }

          await page.keyboard.press('Escape');
          await wait(500);
        }
      } else {
        bug('MEDIUM', 'No invite member button visible', 'Cannot find invite/add member button', 'settings/members');
      }
    } else {
      bug('HIGH', 'Members tab not found in settings', 'Cannot locate members tab', 'settings');
    }

    // --- 5f. Campus Tab ---
    console.log('\n  --- 5f. Campus ---');
    const campusTab = page.locator('button:has-text("Campus"), [role="tab"]:has-text("Campus"), a:has-text("Campus")').first();
    if (await campusTab.isVisible()) {
      await campusTab.click();
      await wait(2000);
      await screenshot(page, '06f-settings-campus');
      ok('Campus tab accessible', 'settings/campus');

      // Check buildings table structure
      const tableRows = await page.locator('tbody tr').count();
      info(`Campus table has ${tableRows} rows`);

      // Check for indented rows (building hierarchy)
      const indentedRows = await page.locator('[class*="indent"], [class*="pl-"], [style*="padding-left"]').count();
      info(`Found ${indentedRows} potentially indented elements in campus`);

      // Look for add building button
      const addBuildingBtn = page.locator('button:has-text("Add Building"), button:has-text("New Building"), button:has-text("Add")').first();
      if (await addBuildingBtn.isVisible()) {
        ok('Add Building button visible', 'settings/campus');
        await addBuildingBtn.click();
        await wait(1000);
        await screenshot(page, '06f-campus-add-building');
        const buildingDialog = page.locator('[role="dialog"], [class*="modal"], [class*="drawer"]').first();
        if (await buildingDialog.isVisible()) {
          ok('Add building dialog opens', 'settings/campus');
          await page.keyboard.press('Escape');
          await wait(500);
        }
      }
    } else {
      // May be under different name
      const facilityTab = page.locator('button:has-text("Facilit"), [role="tab"]:has-text("Facilit")').first();
      if (await facilityTab.isVisible()) {
        await facilityTab.click();
        await wait(1500);
        ok('Facility/Campus tab accessible under different name', 'settings/campus');
      } else {
        bug('MEDIUM', 'Campus tab not found in settings', 'Cannot locate campus/buildings tab', 'settings');
      }
    }

    // --- 5g. Academic Calendar Tab ---
    console.log('\n  --- 5g. Academic Calendar ---');
    const acalTab = page.locator('button:has-text("Academic"), [role="tab"]:has-text("Academic"), a:has-text("Academic Calendar")').first();
    if (await acalTab.isVisible()) {
      await acalTab.click();
      await wait(1500);
      await screenshot(page, '06g-settings-academic-calendar');
      ok('Academic Calendar tab accessible', 'settings/academic-calendar');
    } else {
      ux('Academic Calendar tab not found', 'Expected Academic Calendar settings tab', 'settings');
    }

    // --- 5h. Add-ons Tab ---
    console.log('\n  --- 5h. Add-ons ---');
    const addOnsTab = page.locator('button:has-text("Add-on"), [role="tab"]:has-text("Add-on"), a:has-text("Add-on")').first();
    if (await addOnsTab.isVisible()) {
      await addOnsTab.click();
      await wait(1500);
      await screenshot(page, '06h-settings-addons');
      ok('Add-ons tab accessible', 'settings/addons');

      // Check for Athletics toggle
      const athleticsToggle = page.locator('text="Athletics"').first();
      if (await athleticsToggle.isVisible()) {
        ok('Athletics module visible in Add-ons', 'settings/addons');
      } else {
        bug('MEDIUM', 'Athletics module not visible in Add-ons', 'Cannot find Athletics toggle in add-ons', 'settings/addons');
      }
    } else {
      bug('MEDIUM', 'Add-ons tab not found in settings', 'Cannot locate add-ons tab', 'settings');
    }

    // =========================================================
    // 6. GLOBAL SEARCH (Cmd+K)
    // =========================================================
    console.log('\n=== 6. GLOBAL SEARCH ===');
    await page.goto(`${BASE_URL}/dashboard`);
    await wait(2000);

    // Try Cmd+K
    await page.keyboard.press('Meta+k');
    await wait(1000);
    await screenshot(page, '07-global-search');

    const searchDialog = page.locator('[role="dialog"], [class*="command"], [class*="search"]').first();
    if (await searchDialog.isVisible()) {
      ok('Global search dialog opens with Cmd+K', 'search');

      // Type a search query
      await page.keyboard.type('test');
      await wait(1500);
      await screenshot(page, '07b-search-results');

      const searchResults = await page.locator('[class*="result"], [class*="item"], [role="option"]').count();
      info(`Search returned ${searchResults} result elements`);

      await page.keyboard.press('Escape');
      await wait(500);
    } else {
      bug('HIGH', 'Global search (Cmd+K) does not open', 'Keyboard shortcut Cmd+K did not open search dialog', 'search');
    }

    // =========================================================
    // 7. NOTIFICATIONS
    // =========================================================
    console.log('\n=== 7. NOTIFICATIONS ===');
    const bellIcon = page.locator('button[aria-label*="notification"], button[aria-label*="bell"], [class*="bell"], [class*="notification-bell"]').first();
    if (await bellIcon.isVisible()) {
      await bellIcon.click();
      await wait(1000);
      await screenshot(page, '08-notifications');

      const notifPanel = page.locator('[class*="notification"], [role="dialog"], [class*="popover"]').first();
      if (await notifPanel.isVisible()) {
        ok('Notification panel opens', 'notifications');
      } else {
        bug('MEDIUM', 'Notification bell click did not open panel', 'Bell icon clicked but no panel appeared', 'notifications');
      }
      await page.keyboard.press('Escape');
      await wait(500);
    } else {
      bug('MEDIUM', 'Notification bell icon not found in header', 'Cannot find notification bell button', 'notifications');
    }

    // =========================================================
    // 8. UX CHECKS — Focus rings, responsive, etc.
    // =========================================================
    console.log('\n=== 8. UX CHECKS ===');

    // Check sidebar focus ring overflow
    await page.goto(`${BASE_URL}/dashboard`);
    await wait(2000);

    // Tab through sidebar to check focus rings
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await screenshot(page, '09-focus-rings');
    info('Tabbed through first two elements to check focus rings');

    // Check for any overflow issues in sidebar
    const sidebarEl = page.locator('aside, nav[class*="sidebar"], [class*="Sidebar"]').first();
    if (await sidebarEl.isVisible()) {
      const overflow = await sidebarEl.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.overflow + ' / ' + style.overflowX + ' / ' + style.overflowY;
      });
      info(`Sidebar overflow: ${overflow}`);

      if (overflow.includes('hidden')) {
        ux('Sidebar has overflow:hidden which may clip focus rings', 'Change to overflow:visible or use clip-path for clipping', 'sidebar');
      }
    }

    // Final full-page screenshot
    await screenshot(page, '10-final-state');

    // =========================================================
    // CONSOLE ERRORS REPORT
    // =========================================================
    if (consoleErrors.length > 0) {
      console.log(`\n=== CONSOLE ERRORS (${consoleErrors.length}) ===`);
      consoleErrors.slice(0, 20).forEach((err, i) => {
        console.log(`  ${i + 1}. ${err.substring(0, 200)}`);
        bug('LOW', `Console error ${i + 1}`, err.substring(0, 200), 'browser-console');
      });
    } else {
      ok('No JavaScript console errors detected', 'browser-console');
    }

  } catch (err) {
    console.error('\nTest runner error:', err);
    await screenshot(page, 'ERROR-state').catch(() => {});
  } finally {
    await wait(2000);
    await browser.close();
  }

  // =========================================================
  // FINAL REPORT
  // =========================================================
  console.log('\n\n========================================');
  console.log('FINAL QA REPORT');
  console.log('========================================\n');

  console.log(`BUGS FOUND: ${findings.bugs.length}`);
  const critical = findings.bugs.filter(b => b.severity === 'CRITICAL');
  const high = findings.bugs.filter(b => b.severity === 'HIGH');
  const medium = findings.bugs.filter(b => b.severity === 'MEDIUM');
  const low = findings.bugs.filter(b => b.severity === 'LOW');

  console.log(`  Critical: ${critical.length}`);
  console.log(`  High: ${high.length}`);
  console.log(`  Medium: ${medium.length}`);
  console.log(`  Low: ${low.length}`);

  if (critical.length > 0) {
    console.log('\n--- CRITICAL BUGS ---');
    critical.forEach(b => console.log(`  * [${b.page}] ${b.title}: ${b.description}`));
  }
  if (high.length > 0) {
    console.log('\n--- HIGH BUGS ---');
    high.forEach(b => console.log(`  * [${b.page}] ${b.title}: ${b.description}`));
  }
  if (medium.length > 0) {
    console.log('\n--- MEDIUM BUGS ---');
    medium.forEach(b => console.log(`  * [${b.page}] ${b.title}: ${b.description}`));
  }
  if (low.length > 0) {
    console.log('\n--- LOW BUGS ---');
    low.forEach(b => console.log(`  * [${b.page}] ${b.title}: ${b.description}`));
  }

  console.log('\n--- UX ISSUES ---');
  findings.uxIssues.forEach(u => console.log(`  * [${u.page}] ${u.title}: ${u.description}`));

  console.log('\n--- WORKING CORRECTLY ---');
  findings.working.forEach(w => console.log(`  * [${w.page}] ${w.title}`));

  console.log('\n--- INFO ---');
  findings.info.forEach(i => console.log(`  * ${i}`));

  // Write JSON report
  const reportPath = path.join(SCREENSHOTS_DIR, 'qa-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(findings, null, 2));
  console.log(`\nJSON report saved to: ${reportPath}`);
  console.log(`Screenshots saved to: ${SCREENSHOTS_DIR}`);
}

run().catch(console.error);
