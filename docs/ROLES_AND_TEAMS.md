# Role-and-Team Architecture

This document defines the definitive school operations platform: **Roles** (global hierarchy) and **Teams** (functional context), plus the **Linfield vs. Alternative** SaaS toggle for event governance.

---

## 1. The Global Hierarchy (Roles)

Roles answer: **"What can I do to the system?"** They are strictly hierarchical to protect workspace and financial information.

### Super Admin (Account Owner / Executive)
- **Visibility:** Full access to all Workspace information, including school-wide budgets and organizational settings.
- **Exclusive power:** The only role that can manage the subscription, view billing, or make purchases.
- **Management:** Full control over all users; the only role that can designate or reassign other Super Admins.

### Admin (Site Admin / Department Lead)
- **Visibility:** Full operational view of events, tickets, and staff directory.
- **Management:** Can create and manage Members and other Admins. Cannot touch billing or elevate users to Super Admin.

### Member (Functional Staff)
- **Visibility:** Zero access to workspace settings, billing, or global budgets.
- **Scope:** Visibility is strictly filtered by their assigned **Team** and personal requests.

---

## 2. Functional Context (Teams)

Teams answer: **"What do I see every day?"** They provide routing logic for feeds and permissions.

### Teacher Team (division-scoped)
- **Identity:** Name is associated with their classroom (e.g. "Sarah Miller — Room 102").
- **Feed:** Access to the Master Calendar and the ability to submit IT Support or Facility Maintenance tickets for their room.
- **Personal forms:** Can build and use "Personal Forms" (e.g. field trip slips) that are only visible to them (`visibility: 'personal'` / `isPersonal: true`).
- **Events:** Depends on the **Linfield vs. Alternative** toggle (see §3).

### IT Support Team
- **Scope:** Technical infrastructure (Wi‑Fi, logins, hardware).
- **Feed:** Only sees tickets categorized as **IT**.
- **Terminology:** "Tech Support / Hardware Help."

### A/V Production Team
- **Scope:** Technical execution for events (sound, lighting, mics).
- **Feed:** Automatically populated by any Event where the requester has checked "A/V Requirements."
- **Terminology:** "Event A/V Requirements."

### Facility Maintenance Team
- **Scope:** Physical campus upkeep (plumbing, HVAC, electrical).
- **Feed:** Only sees tickets categorized as **MAINTENANCE**.
- **Terminology:** "Facility Repair."

### Others
- Security (Campus Safety), Administration, Athletics, Web, etc., as configured.

---

## 3. The "Linfield vs. Alternative" SaaS Toggle

**Setting:** `Organization.allowTeacherEventRequests` (boolean).

### If `FALSE` (The Linfield Model)
- **Teacher experience:** The "Create Event" button is hidden. Teachers see:  
  *"Event scheduling is managed by the Site Administration. Please contact your Site Secretary to book a facility."*
- **Gatekeeper:** Only Admins and Super Admins can enter events into the Master Calendar.

### If `TRUE` (The Alternative Model)
- **Teacher experience:** Teachers can submit event requests; they are saved with `status: PENDING_APPROVAL`.
- **Safeguard:** These requests do not appear on the public calendar or block inventory until an Admin approves them.
- **Calendar:** GET `/api/events` returns only `status: APPROVED` events by default; use `?includePending=true` for admin views of pending requests.

---

## 4. Strategic Terminology

| User need           | Team routed to   | Terminology used           |
|---------------------|------------------|----------------------------|
| Fix my laptop       | IT Support       | Tech Support / Hardware Help |
| Set up microphones  | A/V Production   | Event A/V Requirements     |
| Fix a leak          | Maintenance      | Facility Repair            |

---

## 5. Data Model Summary

- **User.role** – `SUPER_ADMIN | ADMIN | TEACHER | MAINTENANCE | SITE_SECRETARY | VIEWER`. Permission checks use `isAdminOrSuperAdmin()` vs. member-level.
- **User.teamIds** – Array of team slugs, e.g. `['teachers']`, `['it','facilities']`. Drives which dashboard sections and features the user sees.
- **Organization.allowTeacherEventRequests** – `false` = Linfield (only Admins create events); `true` = Alternative (teachers can submit pending requests).
- **Team** (optional table) – `id`, `organizationId`, `name`, `slug`. Used for org-specific team names; frontend still uses standard slugs in `User.teamIds`.
- **Form.visibility** – `'org'` (default) or `'personal'`. Personal forms only returned to the creator; API can expose `isPersonal: true` when `visibility === 'personal'`.
- **Event.status** – `PENDING_APPROVAL | APPROVED | REJECTED`. Admins create with `APPROVED`; teachers (when toggle is on) create with `PENDING_APPROVAL`.

---

## 6. Execution Checklist

- [x] **Signup hardening:** First user created for any new school is automatically `SUPER_ADMIN` (`platform/src/app/api/auth/signup/route.ts` and Google callback).
- [x] **Schema:** `Organization.allowTeacherEventRequests`, `Team` model, `Form.visibility` (+ `createdByUserId` for personal), `Event.status` in use.
- [x] **UI filter:** "Create Event" button and event-creation flows respect User Role and the SaaS toggle; Linfield message shown when user cannot create events.
- [x] **Settings:** Super Admins can toggle "Teacher event requests" in **Settings → General** (PATCH `/api/organization/branding` with `allowTeacherEventRequests`).
- **Code recovery:** If you lose Super Admin access, manually set your user’s `role` to `SUPER_ADMIN` in the database.
