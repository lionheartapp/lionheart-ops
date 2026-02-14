# Lionheart School Operations Platform — Context for Gemini Gem

> Copy this document into a Gemini Gem to give the AI context about this codebase when helping you build, debug, or extend it.

---

## What This Software Is

**Lionheart** (branded "Lionheart Operations") is a **school facility and operations management platform** built for **Linfield Christian School** and designed to replace School Dude. It is being productized as a multi-tenant SaaS for K–12 schools.

**Primary goal:** Move from a reactive, human-monitored calendar to a **proactive** system that catches conflicts automatically and unifies events, facilities, IT support, and maintenance in one place.

---

## Architecture

Two separate applications that work together:

| App | Tech | Port | Purpose |
|-----|------|------|---------|
| **Lionheart** | Vite + React | 5173 | Dashboard, events calendar, forms, facilities/IT tickets, pond widget, inventory |
| **Platform** | Next.js + Prisma + Postgres | 3001 | APIs, campus map, event requests, database |

- Lionheart is the main UI; it calls Platform APIs for data.
- Both must run: `npm run dev` in root (Lionheart) and `cd platform && npm run dev` (Platform).
- CORS: Platform allows Lionheart via `VITE_PLATFORM_URL` in root `.env` (e.g. `http://localhost:3001`).

---

## Key Features

### 1. Events & Calendar (Proactive)
- **Conflict detection:** Chairs/tables vs inventory; spatial/timing conflicts (30-min buffer, same/adjacent rooms).
- **Natural-language event creation:** SmartEventModal + Gemini extracts date, location, tables/chairs, AV needs.
- **Smart forms:** AI Form Builder; Event Request Form (parse text → prefill).
- **Permissions:** Site secretaries, admins, and `canSubmitEvents` users can create; all staff can view.
- **Data sources:** School Dude iCal feed (migration bridge); Platform Events API. CIF/Athletic integration planned.

### 2. Facilities & IT Support
- Facilities and IT tickets (support requests).
- Inventory: items, stock by location, availability checks.
- Completion flow: mark done, log man hours, receipt upload (OCR), future takeaway → Knowledge Base.

### 3. Pond Maintenance
- **PondLog:** pH, turbidity, temperature, dissolved oxygen, alkalinity.
- **Pond Health widget:** Latest readings, SafeZone highlighting, manual log.
- **Dosage calculator:** Copper Sulfate (algae) or Aquatic Dye; alkalinity required for Copper; turtle-safe cap (0.2 ppm).
- **Safety filter:** Alkalinity &lt; 50 ppm → block Copper; max safe Cu ppm = Alkalinity ÷ 100.
- **Alerts:** Low DO (&lt; 5 ppm) → aerator message; low alkalinity → red banner.

### 4. Campus Map
- 2D/3D map; room pins; Matterport/Pannellum 360 tours.
- Deep links: `/campus?roomId=xxx`.

### 5. Command Bar (⌘K / Ctrl+K)
- Search teachers, rooms, tickets.
- Teachers: Platform DB + Linfield directory (`linfieldDirectory.js`).
- Selecting teacher/room opens Platform campus map.

### 6. Monthly Reporting
- Cron: spend vs budget, AI cost-saving tip; email via Resend when configured.

---

## File Structure

```
/Linfield Test/
├── src/                    # Lionheart (Vite) frontend
│   ├── App.jsx
│   ├── components/         # PondHealthWidget, CommandBar, SmartEventModal, EventCreatorModal, etc.
│   ├── data/               # linfieldDirectory.js, eventsData, supportTicketsData, teamsData
│   ├── services/           # gemini.js, icalService.js
│   └── config/             # orgContext.js
├── platform/               # Next.js backend
│   ├── prisma/
│   │   └── schema.prisma   # All DB models
│   └── src/
│       ├── app/
│       │   ├── api/        # REST endpoints
│       │   ├── campus/     # Campus map page
│       │   ├── events/     # Event request form
│       │   └── ...
│       └── lib/            # pondConstants.ts, prisma, cors
├── docs/
│   ├── POND_MODULE.md
│   ├── SAAS_PRODUCT_ROADMAP.md
│   └── SAAS_FOUNDATION_CHANGES.md
├── .env                    # VITE_PLATFORM_URL, VITE_ORG_*, VITE_GEMINI_API_KEY, etc.
└── package.json
```

---

## Platform APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/search?q=` | GET | Teachers, rooms, active tickets |
| `/api/rooms` | GET | All rooms with buildings |
| `/api/users` | GET | Users (for event routing) |
| `/api/events` | POST | Create event |
| `/api/events/conflicts` | POST | Check chairs/tables inventory + spatial conflicts |
| `/api/events/parse` | POST | AI parse natural language → event fields |
| `/api/pond-sensor` | GET/POST | Latest reading / log new reading |
| `/api/pond/dosage` | GET | Copper/dye dosage (volume, treatment, alkalinity, turtles) |
| `/api/pond/readings` | GET | Recent pond logs |
| `/api/receipts/ocr` | POST | OCR receipt (vendor, date, total) |
| `/api/expenses` | POST | Log expense from ticket |
| `/api/knowledge-base/tips` | POST | Add maintenance tip |
| `/api/cron/monthly-report` | GET | Monthly report (needs secret/Bearer) |

---

## Database Models (Prisma)

- **Organization** — Tenant (SaaS)
- **User** — Roles: TEACHER, MAINTENANCE, ADMIN, SITE_SECRETARY, VIEWER; `canSubmitEvents`
- **Building** — Division: ELEMENTARY, MIDDLE, HIGH
- **Room** — matterportUrl, coordinates, adjacentRoomIds (conflict check)
- **TeacherSchedule** — User ↔ Room, dayOfWeek, startTime, endTime
- **Ticket** — MAINTENANCE, IT, EVENT; status, priority, manHours
- **Event** — date, startTime, roomId, chairsRequested, tablesRequested, status
- **PondLog** — pH, turbidity, temperature, dissolvedOxygen, alkalinity
- **InventoryItem**, **InventoryStock** — Tables, chairs, etc.
- **Expense**, **Budget**, **MaintenanceTip**, **KnowledgeBaseEntry**

---

## Environment Variables

**Root (Lionheart):**
- `VITE_PLATFORM_URL` — e.g. `http://localhost:3001`
- `VITE_ORG_NAME`, `VITE_ORG_WEBSITE`
- `VITE_GEMINI_API_KEY` — For Smart Event, AI Form, event parse

**Platform:**
- `DATABASE_URL` — Postgres (Supabase provides this)

---

## Data Sources

| Data | Source |
|------|--------|
| Teachers (search) | Platform DB (User + TeacherSchedule) + `linfieldDirectory.js` |
| Rooms, buildings | Platform DB |
| Events | Platform DB + School Dude iCal (Lionheart) |
| Tickets | Lionheart state (supportRequests) + Platform DB for platform tickets |
| Pond | Platform DB (PondLog) |
| Inventory | Platform DB |
| Staff directory | `src/data/linfieldDirectory.js` (DIRECTORY_USERS, DIRECTORY_TEAMS) |

---

## Pond Thresholds (Aquaculture)

| Parameter | Ideal | Warning | Danger |
|-----------|-------|---------|--------|
| pH | 7.0–8.0 | &lt;6.5 or &gt;8.5 | &lt;5.5 or &gt;9.5 |
| Temp | 65–78°F | &lt;50 or &gt;85°F | &gt;90°F |
| DO | 6–9 ppm | &lt;5 ppm | &lt;3 ppm |
| Turbidity | 0–10 NTU | &gt;25 NTU | &gt;50 NTU |
| Alkalinity | 90–120 ppm | &lt;50 ppm | &lt;20 ppm |

Copper: Alkalinity &lt; 50 → do not use. Max safe ppm = Alkalinity ÷ 100. Turtles: max 0.2 ppm.

---

## Not Yet Implemented

- CIF/Athletic calendar integration
- Smart Plug API (auto aerator when DO &lt; 5)
- Grainger/Zoro price scraper ("School Value Pick")
- DIVISION_HEAD role (use `canSubmitEvents` for now)
- Full auth (Supabase keys in .env but not wired)
- Multi-tenant org routing

---

## Conventions

- Lionheart: `.jsx`, `import.meta.env.VITE_*`
- Platform: `.ts`/`.tsx`, `@/lib`, `@/app`
- Dark mode default in Lionheart
- Alerts go to "maintenance" (not a specific person)
