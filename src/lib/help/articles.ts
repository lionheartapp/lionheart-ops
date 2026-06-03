/**
 * Knowledge base content registry.
 *
 * All public help articles + their categories live here. Adding a new
 * article is as simple as appending to `HELP_ARTICLES` — the index page,
 * sitemap, and structured data pick it up automatically.
 */

import type { HelpArticle, HelpCategory } from './types'

/* ─── Categories ────────────────────────────────────────────────────────── */

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    slug: 'getting-started',
    title: 'Getting Started',
    description: 'Set up your account, sign in, and get oriented.',
    icon: 'BookOpen',
  },
  {
    slug: 'tickets',
    title: 'Tickets & Work Orders',
    description: 'Submit, route, and resolve maintenance and IT requests.',
    icon: 'Wrench',
  },
  {
    slug: 'events',
    title: 'Events',
    description: 'Plan, approve, register, and run school events.',
    icon: 'Calendar',
  },
  {
    slug: 'campus',
    title: 'Campus & Schools',
    description: 'Configure buildings, rooms, schools, and locations.',
    icon: 'Building2',
  },
  {
    slug: 'inventory',
    title: 'Inventory & Assets',
    description: 'Track devices, equipment, and consumables across sites.',
    icon: 'Boxes',
  },
  {
    slug: 'admin',
    title: 'Admin & Permissions',
    description: 'Manage users, roles, teams, and security.',
    icon: 'ShieldCheck',
  },
  {
    slug: 'leo-ai',
    title: 'Leo AI',
    description: 'Use Lionheart’s AI assistant to move faster.',
    icon: 'Sparkles',
  },
]

/* ─── Articles ──────────────────────────────────────────────────────────── */

export const HELP_ARTICLES: HelpArticle[] = [
  /* ───────── Getting Started ───────── */
  {
    slug: 'welcome-to-lionheart',
    title: 'Welcome to Lionheart',
    description:
      'A quick tour of what Lionheart does and how the platform is organized — start here.',
    category: 'getting-started',
    audience: ['all'],
    updated: '2026-04-30',
    readMinutes: 4,
    keywords: ['overview', 'introduction', 'tour', 'what is lionheart'],
    body: [
      {
        type: 'paragraph',
        text: 'Lionheart is the operations layer for K-12 schools. Tickets, events, facilities, inventory, and people — all in one place, all kept inside the walls of your organization.',
      },
      { type: 'heading', level: 2, text: 'How the platform is organized', id: 'organization' },
      {
        type: 'paragraph',
        text: 'Every Lionheart account is a tenant. A tenant typically represents a school, district, or campus group. Inside the tenant you will see five core areas:',
      },
      {
        type: 'list',
        items: [
          'Maintenance — tickets, work orders, assets, preventive maintenance.',
          'Events — drafts, approvals, public registration, day-of run sheets.',
          'Campus — buildings, areas, rooms, and schools that everything else attaches to.',
          'IT — device lifecycle, password resets, and help-desk workflows.',
          'Settings — users, roles, teams, branding, and integrations.',
        ],
      },
      { type: 'heading', level: 2, text: 'Who uses Lionheart', id: 'roles' },
      {
        type: 'paragraph',
        text: 'Lionheart is built around four built-in roles: super-admin, admin, member, and viewer. Most people will be members — they submit requests, RSVP to events, and check their schedule. Admins manage the org. Viewers can see but not change. Super-admins do everything.',
      },
      {
        type: 'callout',
        tone: 'tip',
        title: 'Where do I go next?',
        body: 'If you are new, read "Signing in for the first time" next. If you are setting your school up from scratch, jump to "Setting up your campus".',
      },
    ],
    related: ['signing-in-first-time', 'setting-up-your-campus', 'managing-users-and-roles'],
  },
  {
    slug: 'signing-in-first-time',
    title: 'Signing in for the first time',
    description:
      'How to claim your account, set a password, and find your way to the right dashboard.',
    category: 'getting-started',
    audience: ['end-user', 'org-admin', 'it-facilities'],
    updated: '2026-04-30',
    readMinutes: 3,
    keywords: ['login', 'password', 'invite', 'first login', 'set password'],
    body: [
      {
        type: 'paragraph',
        text: 'When an admin invites you to Lionheart, you will receive an email with a setup link. The link is valid for a limited time — open it on the device you plan to use most often.',
      },
      { type: 'heading', level: 2, text: 'Step-by-step', id: 'steps' },
      {
        type: 'steps',
        items: [
          {
            title: 'Open the invite email',
            body: 'Look for a message from no-reply@lionheartapp.com. Click "Set up your account".',
          },
          {
            title: 'Choose a password',
            body: 'Pick something you do not use anywhere else. Lionheart enforces a minimum strength but cannot replace a password manager.',
          },
          {
            title: 'Sign in at your school’s URL',
            body: 'Your org has a unique subdomain — for example, yourschool.lionheartapp.com. Bookmark it.',
          },
          {
            title: 'Land on the right dashboard',
            body: 'Lionheart routes you based on your role. Members go to the home dashboard; IT and facilities team members can switch into their queue from the sidebar.',
          },
        ],
      },
      {
        type: 'callout',
        tone: 'warn',
        title: 'Setup link expired?',
        body: 'Setup links expire after a short window. Ask an admin to resend the invite — they can do this from Settings → Members.',
      },
      { type: 'heading', level: 2, text: 'Forgot your password?', id: 'forgot' },
      {
        type: 'paragraph',
        text: 'Click "Forgot password" on the sign-in screen. We email a reset link that is valid for one hour.',
      },
    ],
    related: ['welcome-to-lionheart', 'managing-users-and-roles'],
  },

  /* ───────── Tickets ───────── */
  {
    slug: 'submitting-a-ticket',
    title: 'Submitting a ticket',
    description:
      'How to file a maintenance or IT request so it lands with the right team and gets resolved fast.',
    category: 'tickets',
    audience: ['end-user'],
    updated: '2026-04-30',
    readMinutes: 4,
    keywords: ['request', 'work order', 'maintenance', 'IT', 'help desk'],
    body: [
      {
        type: 'paragraph',
        text: 'A ticket is the unit of work in Lionheart. Anything you need fixed, replaced, set up, or moved should start as a ticket so the right team sees it and you can track it.',
      },
      { type: 'heading', level: 2, text: 'Open a new ticket', id: 'open' },
      {
        type: 'steps',
        items: [
          {
            title: 'Click "New ticket" from the dashboard',
            body: 'You can also use the keyboard shortcut N from anywhere in the app.',
          },
          {
            title: 'Pick a category',
            body: 'Maintenance, IT, A/V, or Custodial. Picking the right category routes the ticket to the right team automatically.',
          },
          {
            title: 'Tell us where',
            body: 'Choose a building and room. If a QR code is posted in the room, scan it from your phone — the location pre-fills.',
          },
          {
            title: 'Describe the issue clearly',
            body: 'One thing per ticket. Include what is broken, what you have already tried, and how urgent it is.',
          },
          {
            title: 'Attach photos if helpful',
            body: 'A 10-second photo replaces 200 words of explanation. Snap it before submitting.',
          },
        ],
      },
      { type: 'heading', level: 2, text: 'What happens next', id: 'lifecycle' },
      {
        type: 'paragraph',
        text: 'New tickets show up in the assigned team’s queue immediately. You will get an email when someone is assigned, when status changes, and when the ticket is resolved. You can always check status from your dashboard or use the public ticket-status page if you submitted without signing in.',
      },
      {
        type: 'callout',
        tone: 'tip',
        title: 'Pro tip',
        body: 'If something is unsafe or affecting many people, mark it Urgent. Urgent tickets ping the on-call lead directly.',
      },
    ],
    related: ['working-tickets-and-work-orders', 'welcome-to-lionheart'],
  },
  {
    slug: 'working-tickets-and-work-orders',
    title: 'Working tickets and work orders',
    description:
      'A field guide for IT and facilities team members: triage, assign, track time, and close.',
    category: 'tickets',
    audience: ['it-facilities'],
    updated: '2026-04-30',
    readMinutes: 6,
    keywords: ['triage', 'assign', 'work order', 'queue', 'maintenance'],
    body: [
      {
        type: 'paragraph',
        text: 'If you are on the IT or facilities team, your home is the queue. This article walks through the day-in-the-life: triaging incoming tickets, working them, and closing them cleanly.',
      },
      { type: 'heading', level: 2, text: 'Your queue', id: 'queue' },
      {
        type: 'paragraph',
        text: 'Open the Maintenance or IT module from the sidebar. Tickets are grouped by status: New, Assigned, In Progress, Waiting, and Resolved. Filter by campus, building, or category to narrow the view.',
      },
      { type: 'heading', level: 3, text: 'Triage in the morning' },
      {
        type: 'list',
        items: [
          'Sort by Created (oldest first) and skim every New ticket.',
          'For each ticket, decide: assign now, ask a clarifying question, or merge with an existing ticket.',
          'If the ticket is in the wrong category, recategorize it — Lionheart re-routes automatically.',
        ],
      },
      { type: 'heading', level: 3, text: 'Working a ticket' },
      {
        type: 'steps',
        items: [
          {
            title: 'Assign it to yourself',
            body: 'Either click your avatar in the assignee field, or use the "Take" button at the top.',
          },
          {
            title: 'Move it to In Progress',
            body: 'This sets expectations for the requester and starts your time-on-task clock if your team uses one.',
          },
          {
            title: 'Comment as you go',
            body: 'Internal notes stay private to your team. Public comments email the requester.',
          },
          {
            title: 'Log parts and time',
            body: 'For maintenance work orders, attach inventory items used and a labor estimate so cost rolls up to the asset.',
          },
          {
            title: 'Resolve and document',
            body: 'When closing, write a one-line root cause. Future you (or a teammate) will thank you when the same issue resurfaces.',
          },
        ],
      },
      {
        type: 'callout',
        tone: 'info',
        title: 'Recurring tickets become PMs',
        body: 'If you find yourself fixing the same thing every quarter, promote the ticket into a preventive maintenance schedule from the asset record. Lionheart will create work orders for you on a cadence.',
      },
    ],
    related: ['submitting-a-ticket', 'managing-inventory-and-assets'],
  },

  /* ───────── Events ───────── */
  {
    slug: 'creating-an-event',
    title: 'Creating an event',
    description:
      'From draft to published, including approvals, registration, and day-of logistics.',
    category: 'events',
    audience: ['org-admin', 'end-user'],
    updated: '2026-04-30',
    readMinutes: 5,
    keywords: ['event', 'calendar', 'registration', 'approval', 'rsvp'],
    body: [
      {
        type: 'paragraph',
        text: 'Events in Lionheart go through a draft → approval → published lifecycle. The same record powers the internal calendar, the public registration page, and the day-of run sheet.',
      },
      { type: 'heading', level: 2, text: 'Create the draft', id: 'draft' },
      {
        type: 'steps',
        items: [
          {
            title: 'Click "+ Create"',
            body: 'Pick the type of event you\'re making: Single Event, Recurring Event, or Multi-day Event.',
          },
          {
            title: 'Fill the essentials',
            body: 'Title, description, date and time, location (a room from your campus), and attendance estimate.',
          },
          {
            title: 'Add resource needs',
            body: 'A/V setup, custodial reset, security coverage, food. Each need becomes a sub-task that the relevant team gets notified about.',
          },
          {
            title: 'Save as draft',
            body: 'Drafts are visible only to you and approvers — nothing is public yet.',
          },
        ],
      },
      { type: 'heading', level: 2, text: 'Approval', id: 'approval' },
      {
        type: 'paragraph',
        text: 'When you submit the draft, it follows your org’s approval rules. By default that is: building owner → operations lead → admin. Each approver can approve, request changes, or reject. Approvers see the resource needs alongside the event so they can sign off on facilities and budget at the same time.',
      },
      { type: 'heading', level: 2, text: 'Publish & registration', id: 'publish' },
      {
        type: 'paragraph',
        text: 'Once approved, you can publish to the internal calendar only, or open public registration at events.lionheartapp.com/<your-org>/<event>. Public events get a shareable link and a QR code for printed flyers.',
      },
      {
        type: 'callout',
        tone: 'tip',
        title: 'Day-of run sheet',
        body: 'Every event has a /dayof page with the schedule, contacts, room layout, and check-in counter — designed to be left open on a tablet at the welcome table.',
      },
    ],
    related: ['welcome-to-lionheart', 'setting-up-your-campus'],
  },

  /* ───────── Campus ───────── */
  {
    slug: 'setting-up-your-campus',
    title: 'Setting up your campus',
    description:
      'Buildings, spaces, rooms, and schools — the foundation everything else attaches to.',
    category: 'campus',
    audience: ['org-admin'],
    updated: '2026-05-15',
    readMinutes: 6,
    keywords: ['buildings', 'rooms', 'spaces', 'schools', 'campus', 'facilities', 'setup', 'locations'],
    body: [
      {
        type: 'paragraph',
        text: 'Tickets, events, inventory, and schedules all reference a location. Time spent setting up your campus on day one pays off every day after.',
      },
      { type: 'heading', level: 2, text: 'The hierarchy', id: 'hierarchy' },
      {
        type: 'paragraph',
        text: 'Lionheart uses a three-level hierarchy:',
      },
      {
        type: 'list',
        ordered: true,
        items: [
          'Building — a physical structure (Main Hall, Gymnasium, Maintenance Shed).',
          'Space — a region of a building (1st Floor, East Wing, Stage). Optional, but useful for big buildings.',
          'Room — the smallest addressable unit (Room 204, Boiler Room, Cafeteria).',
        ],
      },
      {
        type: 'paragraph',
        text: 'Multi-school orgs add a fourth level — School — that wraps everything above. A school owns its own buildings, calendar, and brand.',
      },
      { type: 'heading', level: 2, text: 'How to set it up', id: 'setup' },
      {
        type: 'steps',
        items: [
          {
            title: 'Open Settings → Facilities',
            body: 'You will see your campus structure. If this is your first time, it starts empty.',
          },
          {
            title: 'Add buildings first',
            body: 'Use the names people actually say out loud. "Main Hall" beats "Building A".',
          },
          {
            title: 'Add rooms',
            body: 'Click into a building and add rooms one at a time. Give each a room number or display name.',
          },
          {
            title: 'Optionally add spaces',
            body: 'Group rooms by floor or wing if it helps your team navigate. Skip this for small buildings.',
          },
        ],
      },
      {
        type: 'callout',
        tone: 'warn',
        title: 'Renames cascade — deletes do not',
        body: 'Renaming a room updates everywhere it is referenced. Deleting a room with active tickets is blocked — you must reassign or close the tickets first.',
      },
    ],
    related: ['creating-an-event', 'submitting-a-ticket', 'managing-inventory-and-assets'],
  },

  /* ───────── Inventory ───────── */
  {
    slug: 'managing-inventory-and-assets',
    title: 'Managing inventory and assets',
    description:
      'Track devices and equipment, link them to rooms and tickets, and see total cost of ownership.',
    category: 'inventory',
    audience: ['it-facilities', 'org-admin'],
    updated: '2026-04-30',
    readMinutes: 5,
    keywords: ['inventory', 'asset', 'devices', 'equipment', 'tco'],
    body: [
      {
        type: 'paragraph',
        text: 'Inventory in Lionheart covers two things: assets (capitalized items with a serial number — laptops, projectors, HVAC units) and consumables (filters, light bulbs, cleaning supplies). Both flow through the same module but behave differently.',
      },
      { type: 'heading', level: 2, text: 'Adding an asset', id: 'add' },
      {
        type: 'steps',
        items: [
          {
            title: 'Open Inventory → Add asset',
            body: 'Or scan a barcode if your team has labeled equipment.',
          },
          {
            title: 'Capture the basics',
            body: 'Make, model, serial number, purchase date, and warranty expiration.',
          },
          {
            title: 'Assign a location',
            body: 'Pick a building and room. Assets without a location appear in the "Unassigned" view.',
          },
          {
            title: 'Set replacement cost and useful life',
            body: 'Lionheart uses these to project replacement budget and to roll up cost-of-ownership when work orders post against the asset.',
          },
        ],
      },
      { type: 'heading', level: 2, text: 'Linking work orders to assets', id: 'link' },
      {
        type: 'paragraph',
        text: 'When you open a ticket on a piece of equipment, attach the asset record. Every hour and every part you log on that ticket rolls up to the asset’s lifetime cost — which is what tells you whether to keep repairing or replace.',
      },
      {
        type: 'callout',
        tone: 'tip',
        title: 'Bulk import',
        body: 'Already have a spreadsheet? Settings → Inventory → Import accepts CSV. Required columns are name, serial, building, room.',
      },
    ],
    related: ['working-tickets-and-work-orders', 'setting-up-your-campus'],
  },
  {
    slug: 'av-rf-command-center',
    title: 'Using the A/V RF Command Center',
    description:
      'How to add wireless gear from Inventory, build event RF plans, upload scans, coordinate open channels, and export a day-of tech packet.',
    category: 'inventory',
    audience: ['it-facilities', 'org-admin'],
    updated: '2026-06-01',
    readMinutes: 8,
    keywords: [
      'av',
      'a/v',
      'rf',
      'wireless',
      'microphone',
      'frequency',
      'scan',
      'inventory',
      'wireless workbench',
      'channel assignments',
    ],
    body: [
      {
        type: 'paragraph',
        text: 'The A/V RF Command Center helps your A/V team plan wireless microphones, body packs, IEMs, receivers, scanners, and other RF-capable gear for school events. It is an advisor: Lionheart can recommend and explain a frequency plan, but your A/V lead still approves the plan and tunes hardware manually.',
      },
      {
        type: 'image',
        src: '/help/av-rf-command-center.png',
        alt: 'A/V RF Command Center dashboard with events, risk cards, and workspace tabs.',
        width: 1184,
        height: 980,
        priority: true,
        caption: 'The Command Center gives the A/V team one home for upcoming events, RF plans, wireless inventory, scans, venue profiles, and bridge status.',
      },
      {
        type: 'callout',
        tone: 'info',
        title: 'Advisor Mode',
        body: 'Lionheart does not push frequencies to microphones or receivers. It scores risk, explains conflicts, and suggests clean channels. A human A/V lead accepts the plan and handles hardware.',
      },
      { type: 'heading', level: 2, text: 'Before you start', id: 'before' },
      {
        type: 'list',
        items: [
          'Make sure the user is on the A/V Production team or has A/V permissions.',
          'Add your wireless gear in Inventory before trying to assign it to an RF plan.',
          'Use one inventory item per trackable piece of wireless gear when possible.',
          'Store frequencies in MHz in the UI. Lionheart stores them as Hz behind the scenes.',
          'Upload scans as frequency and signal-strength pairs when you have them.',
        ],
      },
      {
        type: 'callout',
        tone: 'tip',
        title: 'Inventory is the source of truth',
        body: 'Do not create a separate A/V equipment list by hand. Add the asset in Inventory, then mark it for RF coordination. The same item can then appear in Inventory and in the RF Command Center.',
      },
      { type: 'heading', level: 2, text: '1. Add wireless gear from Inventory', id: 'inventory' },
      {
        type: 'paragraph',
        text: 'Open A/V Production → RF Command Center → Wireless Inventory. Click Add inventory item. This opens the same inventory drawer used by the main Inventory module, so asset name, location, serial numbers, documentation, checkout settings, and RF details stay together.',
      },
      {
        type: 'image',
        src: '/help/av-rf-inventory.png',
        alt: 'Wireless Inventory tab showing Add inventory item and discoverable inventory.',
        width: 1184,
        height: 980,
        caption: 'Wireless Inventory shows linked RF devices and discoverable A/V inventory that can be linked later.',
      },
      {
        type: 'steps',
        items: [
          {
            title: 'Click Add inventory item',
            body: 'Use this even when you are working from the RF page. It keeps the physical asset in the normal inventory system.',
          },
          {
            title: 'Enter the asset basics',
            body: 'Give it a clear name such as Handheld 1, ULXD body pack 2, or RF Explorer scanner. Add location and checkout settings if your team tracks those.',
          },
          {
            title: 'Open Details',
            body: 'Add manufacturer, model, serial numbers, product image, documentation links, and tags.',
          },
          {
            title: 'Turn on RF coordination',
            body: 'Check Use in RF coordination, choose the RF type, and add the current MHz if known.',
          },
          {
            title: 'Save the inventory item',
            body: 'Lionheart creates or updates the linked wireless device record automatically.',
          },
        ],
      },
      {
        type: 'image',
        src: '/help/av-rf-inventory-drawer.png',
        alt: 'Inventory drawer with RF coordination controls.',
        width: 640,
        height: 948,
        caption: 'The RF coordination section tells Lionheart that this inventory item should be available for wireless frequency planning.',
      },
      { type: 'heading', level: 3, text: 'What counts as RF-capable?' },
      {
        type: 'paragraph',
        text: 'Common examples are handheld wireless mics, lavaliers, headset packs, body packs, IEM packs, wireless receivers, antennas, and RF scanners. Projectors, cables, speakers, and stands should usually stay in Inventory only unless they need RF planning.',
      },
      { type: 'heading', level: 3, text: 'Discoverable inventory' },
      {
        type: 'paragraph',
        text: 'If an existing inventory item looks RF-capable but is not linked yet, it appears under Discoverable inventory. Click Link to RF to make it available in frequency plans. This is useful when old inventory already contains items like Wireless Microphone Set.',
      },
      { type: 'heading', level: 2, text: '2. Open or create an event RF plan', id: 'event-plan' },
      {
        type: 'paragraph',
        text: 'Most plans should be tied to an event. From the Command Center tab, click an event in Today and next up. If a plan already exists, Lionheart opens it. If no plan exists, Lionheart creates one for that event and links the event context automatically.',
      },
      {
        type: 'list',
        items: [
          'Use event plans for assemblies, graduations, performances, board meetings, athletics ceremonies, testing days, and any event using wireless gear.',
          'Use a standalone plan only for prep work, testing, or a venue-wide scan with no event yet.',
          'Venue context matters. A plan linked to the right building or room can use venue RF profiles and scan history later.',
        ],
      },
      { type: 'heading', level: 2, text: '3. Build channel assignments', id: 'assignments' },
      {
        type: 'paragraph',
        text: 'A channel assignment is one wireless use in the event: host, podium, handheld 1, lapel for principal, backup mic, IEM mix, or a receiver channel. Add one row per wireless channel you need to coordinate.',
      },
      {
        type: 'image',
        src: '/help/av-rf-frequency-plan.png',
        alt: 'Frequency plan screen with channel assignments, scan import, and spectrum panel.',
        width: 1184,
        height: 980,
        caption: 'The Frequency Plans tab is where the A/V lead builds channel assignments, uploads scans, coordinates, reviews risk, and exports the plan.',
      },
      {
        type: 'steps',
        items: [
          {
            title: 'Choose a use label',
            body: 'Use labels that match the day-of run sheet: Host, Podium, Handheld 1, Backup, Body pack 1, IEM A, or Receiver 3.',
          },
          {
            title: 'Pick a device',
            body: 'Choose a linked wireless inventory item. If the device is missing, go back to Wireless Inventory and add or link it.',
          },
          {
            title: 'Enter a known MHz if you have one',
            body: 'If the mic is already tuned, enter the current frequency. If you want Lionheart to suggest a frequency, leave it blank.',
          },
          {
            title: 'Lock fixed frequencies',
            body: 'Locked assignments stay where they are when Lionheart calculates open channels. Use this for channels you cannot move.',
          },
          {
            title: 'Click Add',
            body: 'Repeat until every mic, pack, IEM, and receiver channel is represented.',
          },
        ],
      },
      {
        type: 'callout',
        tone: 'tip',
        title: 'Good labels prevent confusion',
        body: 'Name the use, not just the hardware. “Podium” is better than “Mic 2” when someone is reading the tech packet during setup.',
      },
      { type: 'heading', level: 2, text: '4. Upload a scan', id: 'scan' },
      {
        type: 'paragraph',
        text: 'Scans help Lionheart avoid noisy parts of the spectrum. Upload CSV, TXT, or scanner exports that contain frequency and signal strength pairs. Rows above the scan threshold become RF exclusions for the plan.',
      },
      {
        type: 'list',
        items: [
          'Use MHz or Hz for the frequency column. The UI displays MHz to three decimals.',
          'Use dBm for signal strength when possible.',
          'Remove header rows before uploading. Lionheart rejects headers and shows row-level errors.',
          'Take scans as close as possible to the event location and event time.',
          'Upload a fresh scan after major room changes, large crowds, temporary broadcast gear, or new wireless systems.',
        ],
      },
      {
        type: 'callout',
        tone: 'warn',
        title: 'Bad scans should fail loudly',
        body: 'If the upload says a row is invalid, fix the scan file instead of guessing. A bad scan can hide real RF risk.',
      },
      { type: 'heading', level: 2, text: '5. Coordinate the plan', id: 'coordinate' },
      {
        type: 'paragraph',
        text: 'Click Coordinate after adding assignments and scans. Lionheart checks spacing, scan exclusions, unknown profiles, and intermod risk. It then scores the plan and creates recommendations for open channels.',
      },
      {
        type: 'list',
        items: [
          'Blocker means the plan needs attention before use.',
          'Warning means the plan may work, but the A/V lead should review it.',
          'Advisory means Lionheart found something worth knowing, usually low confidence or missing device data.',
          'Low risk means no major RF conflicts were found from the available data.',
        ],
      },
      { type: 'heading', level: 3, text: 'What Lionheart checks' },
      {
        type: 'list',
        items: [
          'Same-frequency conflicts.',
          'Frequencies that are too close based on the device profile.',
          '3rd-order intermod products such as 2A - B and 2B - A.',
          '5th-order intermod products such as 3A - 2B and 3B - 2A.',
          'Scan-based noisy ranges.',
          'Venue exclusions and known bad ranges.',
          'Unknown device profiles that need conservative assumptions.',
        ],
      },
      { type: 'heading', level: 2, text: '6. Review and accept recommendations', id: 'recommendations' },
      {
        type: 'paragraph',
        text: 'Recommendations appear below the assignment table when Lionheart finds cleaner options. Review the reason before accepting. Accepting a recommendation updates the assignment frequency, then Lionheart re-checks the plan.',
      },
      {
        type: 'steps',
        items: [
          {
            title: 'Read the recommendation',
            body: 'Look at the suggested MHz, confidence, and explanation.',
          },
          {
            title: 'Check the spectrum panel',
            body: 'Confirm the suggested channel does not land in a noisy scanned range or near a locked channel.',
          },
          {
            title: 'Accept the recommendation',
            body: 'Lionheart updates the plan. You still tune the real hardware manually.',
          },
          {
            title: 'Coordinate again if needed',
            body: 'Any accepted change can affect the rest of the plan, so let Lionheart re-score it.',
          },
        ],
      },
      { type: 'heading', level: 2, text: '7. Export the tech packet', id: 'export' },
      {
        type: 'paragraph',
        text: 'When the plan is ready, export the CSV from the event context panel. Use it as the day-of tech packet or copy it into your team’s run sheet. The first version exports CSV. Printable PDF support can be added later.',
      },
      {
        type: 'list',
        items: [
          'Event or plan name.',
          'Use label.',
          'Assigned device.',
          'Frequency in MHz.',
          'Locked/open state.',
          'Soundcheck status.',
          'Notes.',
        ],
      },
      {
        type: 'callout',
        tone: 'info',
        title: 'Hardware tuning remains manual',
        body: 'After exporting, the A/V lead tunes the physical devices and verifies audio during soundcheck. Lionheart is the planning and documentation layer.',
      },
      { type: 'heading', level: 2, text: 'Day-of checklist', id: 'checklist' },
      {
        type: 'list',
        ordered: true,
        items: [
          'Open the event RF plan.',
          'Confirm every wireless use has an assignment.',
          'Upload or confirm the latest scan.',
          'Click Coordinate.',
          'Fix blockers first.',
          'Review warnings and advisories.',
          'Accept useful recommendations.',
          'Tune hardware manually.',
          'Run soundcheck.',
          'Export the tech packet.',
        ],
      },
      { type: 'heading', level: 2, text: 'Troubleshooting', id: 'troubleshooting' },
      {
        type: 'list',
        items: [
          'Device is missing from the plan picker: go to Wireless Inventory and link it to RF.',
          'Inventory item appears as discoverable: click Link to RF or edit it in the inventory drawer and turn on Use in RF coordination.',
          'Scan upload fails: remove headers and make sure each row has frequency and signal strength.',
          'Plan is low confidence: add manufacturer, model, tuning range, or device profile details.',
          'A locked channel keeps causing conflicts: either unlock it or move the real hardware if the A/V lead approves.',
          'Event is not listed: make sure the event requires A/V and is scheduled soon enough to appear in Today and next up.',
        ],
      },
    ],
    related: ['managing-inventory-and-assets', 'creating-an-event', 'working-tickets-and-work-orders'],
  },

  /* ───────── Admin ───────── */
  {
    slug: 'managing-users-and-roles',
    title: 'Managing users, roles, and teams',
    description:
      'Invite people, assign the right role, group them into teams, and keep your org tidy as it grows.',
    category: 'admin',
    audience: ['org-admin'],
    updated: '2026-04-30',
    readMinutes: 6,
    keywords: ['users', 'invite', 'roles', 'permissions', 'teams', 'admin'],
    body: [
      {
        type: 'paragraph',
        text: 'Every Lionheart org ships with four built-in roles and five built-in teams. You can rename, edit, or extend them — but the defaults cover most schools without changes.',
      },
      { type: 'heading', level: 2, text: 'The four built-in roles', id: 'roles' },
      {
        type: 'list',
        items: [
          'Super-admin — can do everything, including changing other admins. Reserve for one or two people.',
          'Admin — manages users, roles, campus settings, and approvals. Cannot remove super-admins.',
          'Member — submits tickets, RSVPs to events, sees their own data. The default for staff.',
          'Viewer — read-only. Useful for board members and auditors.',
        ],
      },
      { type: 'heading', level: 2, text: 'The five built-in teams', id: 'teams' },
      {
        type: 'paragraph',
        text: 'Teams determine routing — when a ticket is created in a category, the matching team gets notified. The defaults are IT Support, Facility Maintenance, A/V Production, Teachers, and Administration.',
      },
      { type: 'heading', level: 2, text: 'Inviting a user', id: 'invite' },
      {
        type: 'steps',
        items: [
          {
            title: 'Open Settings → Members',
            body: 'You will see everyone in the org with their role and teams.',
          },
          {
            title: 'Click "Invite"',
            body: 'Enter email, pick a role, and tick any teams they belong to.',
          },
          {
            title: 'Send',
            body: 'Lionheart emails a setup link. The user has 7 days to claim it; you can resend at any time.',
          },
        ],
      },
      { type: 'heading', level: 2, text: 'Custom roles', id: 'custom' },
      {
        type: 'paragraph',
        text: 'For more granular control, create a custom role from Settings → Roles. Roles are made of permissions in the form resource:action — for example, tickets:read:all or events:approve. Hover any permission for a plain-English description.',
      },
      {
        type: 'callout',
        tone: 'warn',
        title: 'Permission cache',
        body: 'After changing someone’s role, it can take up to 30 seconds for the change to take effect across the app. This is normal — Lionheart caches permissions per-user to keep the UI fast.',
      },
    ],
    related: ['welcome-to-lionheart', 'signing-in-first-time'],
  },

  /* ───────── Leo AI ───────── */
  {
    slug: 'leo-ai-overview',
    title: 'Using Leo AI',
    description:
      'What Leo can do, where it shows up, and how to get good answers out of it.',
    category: 'leo-ai',
    audience: ['all'],
    updated: '2026-04-30',
    readMinutes: 4,
    keywords: ['leo', 'ai', 'assistant', 'gemini', 'help'],
    body: [
      {
        type: 'paragraph',
        text: 'Leo is the AI assistant built into Lionheart. It does three things well: drafts events, diagnoses maintenance issues from a description or photo, and turns raw data into reports.',
      },
      { type: 'heading', level: 2, text: 'Where Leo lives', id: 'where' },
      {
        type: 'list',
        items: [
          'Maintenance triage — when you submit a ticket with a photo, Leo suggests a category and likely root cause.',
          'Reports — admin dashboards have a "Summarize" button that turns the current view into a written board-ready summary.',
        ],
      },
      { type: 'heading', level: 2, text: 'How to get good answers', id: 'prompts' },
      {
        type: 'list',
        items: [
          'Be specific. "Projector in Room 204 has a green tint" beats "projector broken".',
          'Add a photo when you can. Leo handles images and almost always does better with one.',
          'Push back. Leo will revise its draft if you tell it what to change — say "shorter and more formal" or "rewrite for parents, not staff".',
        ],
      },
      {
        type: 'callout',
        tone: 'info',
        title: 'Privacy',
        body: 'Leo runs on your tenant’s data only and never trains on it. Prompts and responses are kept in your org for audit and improvement.',
      },
    ],
    related: ['creating-an-event', 'submitting-a-ticket'],
  },
]

/* ─── Lookup helpers ────────────────────────────────────────────────────── */

export function getArticleBySlug(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.slug === slug)
}

export function getArticlesByCategory(slug: string): HelpArticle[] {
  return HELP_ARTICLES.filter((a) => a.category === slug)
}

export function getCategoryBySlug(slug: string): HelpCategory | undefined {
  return HELP_CATEGORIES.find((c) => c.slug === slug)
}

export function getRelatedArticles(article: HelpArticle, limit = 3): HelpArticle[] {
  if (article.related && article.related.length > 0) {
    return article.related
      .map((s) => getArticleBySlug(s))
      .filter((a): a is HelpArticle => Boolean(a))
      .slice(0, limit)
  }
  return HELP_ARTICLES.filter(
    (a) => a.category === article.category && a.slug !== article.slug
  ).slice(0, limit)
}
