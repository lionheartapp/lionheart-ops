#!/usr/bin/env node
/**
 * Seed Linfield Christian School with diverse users, tickets, KB articles, and inventory.
 * Run: node scripts/seed-linfield-users.mjs
 *
 * Prerequisites: dev server must be running on port 3004.
 * All users get password "test123".
 */

import { SignJWT } from 'jose'
import { hash } from 'bcryptjs'

const BASE = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3004'
const ORG_ID = 'cmm53helb0000n8hbhthyh4b7'       // Linfield Christian School
const ADMIN_USER_ID = 'cmm53helb0001n8hbfhbowqr3' // Michael Kerley (super-admin)
const ADMIN_EMAIL = 'mkerley@linfield.com'
const AUTH_SECRET = 'dev-lionheart-secret-change-before-production'

// ─── Helpers ────────────────────────────────────────────────────────────────

async function makeToken(userId = ADMIN_USER_ID, email = ADMIN_EMAIL) {
  const secret = new TextEncoder().encode(AUTH_SECRET)
  return new SignJWT({ userId, organizationId: ORG_ID, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret)
}

let TOKEN = ''
function headers() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${TOKEN}`,
  }
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!data.ok) {
    console.error(`  ✗ POST ${path} failed:`, data.error?.message || JSON.stringify(data))
    return null
  }
  return data.data
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { headers: headers() })
  const data = await res.json()
  if (!data.ok) {
    console.error(`  ✗ GET ${path} failed:`, data.error?.message || JSON.stringify(data))
    return null
  }
  return data.data
}

function log(emoji, msg) {
  console.log(`${emoji} ${msg}`)
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  TOKEN = await makeToken()
  log('🚀', 'Starting Linfield user & content seed...\n')

  // ── Step 1: Fetch existing roles and teams ──────────────────────────
  log('📋', 'Fetching roles and teams...')

  const roles = await get('/api/settings/roles')
  const teams = await get('/api/settings/teams')

  if (!roles || !teams) {
    console.error('Failed to fetch roles or teams. Is the server running?')
    process.exit(1)
  }

  const roleMap = {}
  for (const r of roles) {
    roleMap[r.slug || r.name] = r.id
  }

  const teamMap = {}
  for (const t of teams) {
    teamMap[t.slug || t.name] = t.id
  }

  log('✓', `Found ${roles.length} roles: ${roles.map(r => r.name).join(', ')}`)
  log('✓', `Found ${teams.length} teams: ${teams.map(t => t.name).join(', ')}\n`)

  // Resolve role IDs (try slug first, then name-based match)
  function findRole(name) {
    return roleMap[name] || roleMap[name.toLowerCase().replace(/\s+/g, '-')] || null
  }

  function findTeam(name) {
    // Try exact slug, then slug-ified name
    const slug = name.toLowerCase().replace(/\s+/g, '-')
    return teamMap[slug] || teamMap[name] || Object.entries(teamMap).find(([k]) => k.includes(slug))?.[1] || null
  }

  // ── Step 2: Create users ────────────────────────────────────────────
  log('👥', 'Creating users...')

  const usersToCreate = [
    { firstName: 'Sarah', lastName: 'Mitchell', email: 'smitchell@linfield.com', role: 'admin', teams: ['Administration'], schoolScope: 'GLOBAL', jobTitle: 'Assistant Principal' },
    { firstName: 'James', lastName: 'Rivera', email: 'jrivera@linfield.com', role: 'member', teams: ['IT Support'], schoolScope: 'GLOBAL', jobTitle: 'IT Specialist' },
    { firstName: 'Emily', lastName: 'Chen', email: 'echen@linfield.com', role: 'viewer', teams: [], schoolScope: 'GLOBAL', jobTitle: 'Office Assistant' },
    { firstName: 'David', lastName: 'Park', email: 'dpark@linfield.com', role: 'admin', teams: ['Administration'], schoolScope: 'GLOBAL', jobTitle: 'Athletic Director' },
    { firstName: 'Lisa', lastName: 'Thompson', email: 'lthompson@linfield.com', role: 'member', teams: ['Teachers'], schoolScope: 'HIGH_SCHOOL', jobTitle: 'Varsity Basketball Coach' },
    { firstName: 'Robert', lastName: 'Garcia', email: 'rgarcia@linfield.com', role: 'member', teams: ['Facility Maintenance'], schoolScope: 'GLOBAL', jobTitle: 'Maintenance Supervisor' },
    { firstName: 'Maria', lastName: 'Santos', email: 'msantos@linfield.com', role: 'member', teams: ['Facility Maintenance'], schoolScope: 'GLOBAL', jobTitle: 'Maintenance Technician' },
    { firstName: 'Kevin', lastName: 'Williams', email: 'kwilliams@linfield.com', role: 'member', teams: ['IT Support'], schoolScope: 'GLOBAL', jobTitle: 'IT Coordinator' },
    { firstName: 'Tyler', lastName: 'Johnson', email: 'tjohnson@linfield.com', role: 'viewer', teams: ['IT Support'], schoolScope: 'HIGH_SCHOOL', jobTitle: 'Student Tech Assistant' },
    { firstName: 'Patricia', lastName: 'Davis', email: 'pdavis@linfield.com', role: 'member', teams: ['Administration'], schoolScope: 'MIDDLE_SCHOOL', jobTitle: 'Secretary' },
    { firstName: 'William', lastName: 'Brown', email: 'wbrown@linfield.com', role: 'viewer', teams: [], schoolScope: 'GLOBAL', jobTitle: 'Board Member' },
    { firstName: 'Jennifer', lastName: 'Lee', email: 'jlee@linfield.com', role: 'viewer', teams: [], schoolScope: 'ELEMENTARY', jobTitle: 'Parent Volunteer' },
    { firstName: 'Mark', lastName: 'Anderson', email: 'manderson@linfield.com', role: 'member', teams: ['Teachers'], schoolScope: 'MIDDLE_SCHOOL', jobTitle: 'PE Teacher & Coach' },
    { firstName: 'Rachel', lastName: 'Kim', email: 'rkim@linfield.com', role: 'member', teams: ['A/V Production'], schoolScope: 'GLOBAL', jobTitle: 'A/V Specialist' },
    { firstName: 'Carlos', lastName: 'Mendez', email: 'cmendez@linfield.com', role: 'member', teams: ['Facility Maintenance'], schoolScope: 'GLOBAL', jobTitle: 'Security & Grounds' },
  ]

  const createdUsers = {}

  for (const u of usersToCreate) {
    const roleId = findRole(u.role)
    if (!roleId) {
      log('⚠️', `  Role "${u.role}" not found, skipping ${u.email}`)
      continue
    }

    const teamIds = u.teams.map(t => findTeam(t)).filter(Boolean)

    const result = await post('/api/settings/users', {
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      roleId,
      teamIds,
      schoolScope: u.schoolScope,
      jobTitle: u.jobTitle,
      provisioningMode: 'ADMIN_CREATE',
    })

    if (result?.user) {
      createdUsers[u.email] = result.user.id
      log('  ✓', `${u.firstName} ${u.lastName} (${u.email}) — ${u.role}${u.teams.length ? ' / ' + u.teams.join(', ') : ''}`)
    } else {
      log('  ⚠', `${u.email} — may already exist`)
    }
  }

  log('', `\n  Created ${Object.keys(createdUsers).length} users\n`)

  // ── Step 3: Create maintenance tickets ──────────────────────────────
  log('🔧', 'Creating maintenance tickets...')

  const maintenanceTickets = [
    { title: 'Gym ceiling light flickering', description: 'Third light from the entrance in the main gym keeps flickering intermittently. May need ballast replacement.', category: 'MAINTENANCE', priority: 'NORMAL', locationText: 'Main Gymnasium', assignEmail: 'rgarcia@linfield.com' },
    { title: 'Broken window latch — Room 204', description: 'Window latch in room 204 is broken. Window cannot close fully, which is a security concern.', category: 'MAINTENANCE', priority: 'HIGH', locationText: 'Building A, Room 204', assignEmail: 'msantos@linfield.com' },
    { title: 'HVAC not cooling in admin offices', description: 'The HVAC system in the admin building is running but not producing cold air. Thermostat shows 78F but set to 72F.', category: 'MAINTENANCE', priority: 'HIGH', locationText: 'Administration Building', assignEmail: 'rgarcia@linfield.com' },
    { title: 'Water fountain leaking — cafeteria', description: 'The water fountain nearest to the kitchen has a slow drip. Water pooling on the floor is a slip hazard.', category: 'MAINTENANCE', priority: 'NORMAL', locationText: 'Cafeteria', assignEmail: 'msantos@linfield.com' },
    { title: 'Parking lot pothole near entrance', description: 'Growing pothole near the main entrance of the parking lot. Several parents have complained. Approx 8 inches wide.', category: 'MAINTENANCE', priority: 'LOW', locationText: 'Main Parking Lot', assignEmail: 'cmendez@linfield.com' },
    { title: 'Replace air filters — Science wing', description: 'Quarterly air filter replacement due for all rooms in the science wing. Filters ordered and in storage.', category: 'MAINTENANCE', priority: 'LOW', locationText: 'Science Wing', assignEmail: 'msantos@linfield.com' },
  ]

  for (const t of maintenanceTickets) {
    const assignedToId = t.assignEmail ? createdUsers[t.assignEmail] : undefined
    const result = await post('/api/tickets', {
      title: t.title,
      description: t.description,
      category: t.category,
      priority: t.priority,
      locationText: t.locationText,
      ...(assignedToId ? { assignedToId } : {}),
    })
    if (result) {
      log('  ✓', t.title)
    }
  }

  // ── Step 4: Create IT tickets ────────────────────────────────────────
  log('\n💻', 'Creating IT tickets...')

  const itTickets = [
    { title: 'Projector not displaying — Room 108', description: 'Epson projector in Room 108 powers on but shows "No Signal" on HDMI input. Tried different cable, same issue.', category: 'IT', priority: 'HIGH', locationText: 'Room 108', assignEmail: 'jrivera@linfield.com' },
    { title: 'Wi-Fi dead zone in library south wing', description: 'Students consistently lose Wi-Fi connection in the south wing of the library. Multiple devices affected.', category: 'IT', priority: 'NORMAL', locationText: 'Library — South Wing', assignEmail: 'kwilliams@linfield.com' },
    { title: 'Teacher laptop won\'t boot — Mrs. Thompson', description: 'Lisa Thompson\'s school-issued Dell laptop stuck on boot loop. Was working fine yesterday. No recent updates.', category: 'IT', priority: 'HIGH', locationText: 'High School Building', assignEmail: 'jrivera@linfield.com' },
    { title: 'Printer jam keeps recurring — Office', description: 'The HP LaserJet in the main office has recurring paper jams. Cleared 3 times today. May need roller replacement.', category: 'IT', priority: 'NORMAL', locationText: 'Main Office', assignEmail: 'tjohnson@linfield.com' },
    { title: 'Setup new Chromebooks for 6th grade', description: '25 new Chromebooks arrived for the 6th grade 1-to-1 program. Need to be enrolled in admin console and labeled.', category: 'IT', priority: 'LOW', locationText: 'IT Storage Room', assignEmail: 'kwilliams@linfield.com' },
    { title: 'Smartboard calibration off — Room 301', description: 'The Smartboard touch input is about 2 inches off from where you tap. Needs recalibration.', category: 'IT', priority: 'LOW', locationText: 'Room 301', assignEmail: 'tjohnson@linfield.com' },
  ]

  for (const t of itTickets) {
    const assignedToId = t.assignEmail ? createdUsers[t.assignEmail] : undefined
    const result = await post('/api/tickets', {
      title: t.title,
      description: t.description,
      category: t.category,
      priority: t.priority,
      locationText: t.locationText,
      ...(assignedToId ? { assignedToId } : {}),
    })
    if (result) {
      log('  ✓', t.title)
    }
  }

  // ── Step 5: Create knowledge base articles ──────────────────────────
  log('\n📚', 'Creating knowledge base articles...')

  const articles = [
    {
      title: 'HVAC Filter Replacement Schedule',
      type: 'PROCEDURE_SOP',
      content: `## Overview\nAll HVAC units across campus require quarterly filter replacements.\n\n## Schedule\n- **January** — All buildings\n- **April** — All buildings\n- **July** — Admin & Science wing only (summer)\n- **October** — All buildings\n\n## Procedure\n1. Turn off HVAC unit at thermostat\n2. Remove old filter (note size on frame)\n3. Insert new filter with airflow arrow pointing toward unit\n4. Turn unit back on and verify operation\n5. Log replacement in maintenance ticket\n\n## Filter Sizes\n- Admin offices: 20x25x1\n- Classrooms: 16x25x1\n- Gym: 20x20x4 (heavy duty)\n\n## Vendor\nFilters ordered through BuildingSupply.com — login in vendor contacts.`,
      tags: ['hvac', 'maintenance', 'filters', 'quarterly'],
    },
    {
      title: 'Emergency Lockdown Procedures',
      type: 'SAFETY_PROTOCOL',
      content: `## Purpose\nThis protocol covers facility lockdown procedures for maintenance and security staff.\n\n## Roles\n- **Security (Carlos)**: Secure all exterior doors, check perimeter gates\n- **Maintenance**: Secure utility rooms, mechanical areas, rooftop access\n- **IT**: Activate PA system announcement, ensure cameras are recording\n\n## Door Lock Sequence\n1. Main entrance (auto-locks via access control)\n2. Side entrances (manual deadbolt)\n3. Gym emergency exits (crash bar — verify from outside)\n4. Kitchen loading dock (roll-down gate)\n\n## Post-Lockdown\n- Verify all doors locked via security camera feed\n- Radio confirmation to front office\n- Maintain position until "all clear" from administration`,
      tags: ['safety', 'lockdown', 'emergency', 'security'],
    },
    {
      title: 'Projector Troubleshooting Guide',
      type: 'EQUIPMENT_GUIDE',
      content: `## Common Issues\n\n### No Signal\n1. Check HDMI cable connection at both ends\n2. Try a different HDMI port on the projector\n3. Toggle input source (usually remote → "Source" button)\n4. Try a known-working cable\n5. If still no signal, check laptop display settings (Win+P or Cmd+F1)\n\n### Dim Image\n- Lamp hours may be high — check via menu → Info → Lamp Hours\n- If over 3000 hours, submit ticket for lamp replacement\n- Clean the air filter (bottom panel) with compressed air\n\n### Overheating / Auto Shutdown\n- Clean air intake vents\n- Ensure nothing is blocking exhaust\n- Verify room temperature is below 85°F\n- If persistent, unit may need internal cleaning\n\n## Models in Use\n- Epson PowerLite 2250U (most classrooms)\n- Epson BrightLink 710Ui (Room 108, 205)\n- ViewSonic PA503W (portable units)`,
      tags: ['it', 'projector', 'troubleshooting', 'equipment'],
    },
    {
      title: 'Vendor Emergency Contacts',
      type: 'VENDOR_CONTACT',
      content: `## HVAC\n- **Pacific Air Services** — (559) 555-0142\n  - Account: LCS-2024-HVAC\n  - Emergency after-hours: (559) 555-0199\n\n## Plumbing\n- **Valley Plumbing Co** — (559) 555-0187\n  - Account: LINFIELD-PLB\n  - 24/7 emergency line available\n\n## Electrical\n- **Bright Spark Electric** — (559) 555-0234\n  - Account: LCS-ELEC\n  - Licensed for commercial/educational\n\n## Pest Control\n- **Guardian Pest Solutions** — (559) 555-0156\n  - Monthly service: 2nd Tuesday\n  - Emergency: same-day response\n\n## Elevator\n- **Pacific Elevator Co** — (559) 555-0278\n  - Service contract: Annual inspection + emergency calls\n  - Admin building elevator cert expires: March 2027`,
      tags: ['vendors', 'contacts', 'emergency', 'maintenance'],
    },
    {
      title: 'Chromebook Enrollment & Setup Procedure',
      type: 'PROCEDURE_SOP',
      content: `## New Chromebook Setup (Batch Process)\n\n### Prerequisites\n- Google Admin Console access (IT Coordinator+)\n- Wi-Fi network: LCS-Setup (password in IT vault)\n- Asset labels printed\n\n### Steps\n1. Unbox and power on Chromebook\n2. Connect to LCS-Setup Wi-Fi\n3. At enrollment screen: press Ctrl+Alt+E\n4. Enter enrollment credentials (service account)\n5. Device should show "This device is managed by Linfield Christian School"\n6. Apply asset label to bottom-left of chassis\n7. Record serial number + asset tag in inventory system\n8. Move to appropriate OU in Admin Console:\n   - Students/Elementary, Students/MiddleSchool, or Students/HighSchool\n9. Verify device policies are applied (check managed bookmarks)\n\n### Per-Student Setup\n- Student logs in with @student.linfield.com account\n- First login triggers policy sync (2-3 min)\n- Verify Chrome extensions are installed automatically`,
      tags: ['it', 'chromebook', 'setup', 'enrollment', 'devices'],
    },
  ]

  for (const a of articles) {
    const result = await post('/api/maintenance/knowledge-base', {
      title: a.title,
      type: a.type,
      content: a.content,
      tags: a.tags,
      isPublished: true,
    })
    if (result) {
      log('  ✓', a.title)
    }
  }

  // ── Step 6: Create inventory items ──────────────────────────────────
  log('\n📦', 'Creating inventory items...')

  const inventoryItems = [
    { name: 'Epson PowerLite 2250U Projector', category: 'AV Equipment', sku: 'PROJ-EP-2250U', quantityOnHand: 12, reorderThreshold: 2 },
    { name: 'Logitech C920 Webcam', category: 'AV Equipment', sku: 'CAM-LOG-C920', quantityOnHand: 8, reorderThreshold: 2 },
    { name: 'Dell Latitude 5540 Laptop', category: 'Computers', sku: 'LAP-DELL-5540', quantityOnHand: 5, reorderThreshold: 3 },
    { name: 'Acer Chromebook Spin 514', category: 'Computers', sku: 'CB-ACER-514', quantityOnHand: 45, reorderThreshold: 10 },
    { name: 'HDMI Cable 6ft', category: 'Cables & Adapters', sku: 'CBL-HDMI-6', quantityOnHand: 30, reorderThreshold: 10 },
    { name: 'USB-C to HDMI Adapter', category: 'Cables & Adapters', sku: 'ADP-USBC-HDMI', quantityOnHand: 15, reorderThreshold: 5 },
    { name: 'Folding Table 6ft', category: 'Furniture', sku: 'FRN-TBL-6FT', quantityOnHand: 24, reorderThreshold: 5 },
    { name: 'Stackable Chair (Black)', category: 'Furniture', sku: 'FRN-CHR-BLK', quantityOnHand: 120, reorderThreshold: 20 },
    { name: 'Shure SM58 Microphone', category: 'AV Equipment', sku: 'MIC-SHURE-SM58', quantityOnHand: 6, reorderThreshold: 2 },
    { name: 'HVAC Air Filter 16x25x1', category: 'Maintenance Supplies', sku: 'FILT-16-25-1', quantityOnHand: 48, reorderThreshold: 24 },
    { name: 'HVAC Air Filter 20x25x1', category: 'Maintenance Supplies', sku: 'FILT-20-25-1', quantityOnHand: 24, reorderThreshold: 12 },
    { name: 'LED Tube Light T8 4ft', category: 'Maintenance Supplies', sku: 'LGT-LED-T8-4', quantityOnHand: 36, reorderThreshold: 12 },
  ]

  for (const item of inventoryItems) {
    const result = await post('/api/inventory', item)
    if (result) {
      log('  ✓', `${item.name} (qty: ${item.quantityOnHand})`)
    }
  }

  // ── Done ────────────────────────────────────────────────────────────
  log('\n🎉', 'Seed complete!')
  log('', `  Users created: ${Object.keys(createdUsers).length}`)
  log('', `  Maintenance tickets: ${maintenanceTickets.length}`)
  log('', `  IT tickets: ${itTickets.length}`)
  log('', `  KB articles: ${articles.length}`)
  log('', `  Inventory items: ${inventoryItems.length}`)
  log('', '')
  log('🔑', 'All users have password: test123 (set via admin-create mode)')
  log('👁️', 'Use "View As..." in the user dropdown to impersonate any user')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
