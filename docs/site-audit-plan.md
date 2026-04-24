# Lionheart Platform — Full Site Audit Plan

**Purpose:** Walk through every click, save, and create in the app to verify functionality, evaluate UX, and identify UI improvements.

**Status:** COMPLETE
**Last updated:** April 23, 2026
**Total sections:** 34
**Total checkpoints:** ~180
**Issues found:** 54 (5 critical, 14 high, 23 medium, 12 low)

---

## How to Use This Document

For each checkpoint:
- [x] **Works** — functionality is correct
- [x] **UX** — flow makes sense, no confusion points
- [x] **UI** — visuals are polished, consistent with design system
- Note any issues inline under the checkpoint

---

## Section 1: Public Pages
- [x] 1a. Landing page — hero, features, pricing link, CTA buttons *(issues: C1, H2, M2, L1)*
- [x] 1b. Pricing page — tiers, feature comparison, CTA *(issues: C1, H1)*
- [x] 1c. Terms / Privacy pages
- [x] 1d. Signup — form validation, org creation, redirect

## Section 2: Auth Flow
- [x] 2a. Login — email/password, error states, org lookup
- [x] 2b. Login — MFA TOTP code entry
- [x] 2c. Login — MFA passkey prompt
- [x] 2d. Login — backup code fallback
- [x] 2e. Forgot password — request email
- [x] 2f. Reset password — set new password
- [x] 2g. Set password — invite link flow *(issue: H3)*
- [x] 2h. Email verification page *(issue: M1)*

## Section 3: Onboarding
- [x] 3a. School info setup — name, address, logo, grade levels
- [x] 3b. Member invite — bulk import, individual invite
- [x] 3c. Plan selection — free/paid, Stripe checkout
- [x] 3d. Checklist widget — dismiss items, completion state *(issue: C2)*

## Section 4: Dashboard
- [x] 4a. Dashboard layout — cards, stats, empty states
- [x] 4b. Quick action buttons
- [x] 4c. Notification bell — dropdown, mark read, mark all read *(issue: H4)*
- [x] 4d. School selector — switch schools, scoped user view
- [x] 4e. Sidebar — nav links, active states, mobile sheet
- [x] 4f. User menu — profile link, logout

## Section 5: Calendar — Views
- [x] 5a. Month view — event dots, click to view
- [x] 5b. Week view — time slots, event blocks
- [x] 5c. Day view — hourly layout
- [x] 5d. Agenda view — list format
- [x] 5e. Navigation — prev/next, today button, view switcher pill

## Section 6: Calendar — CRUD & Sidebar
- [x] 6a. Create event — click slot, fill form, save
- [x] 6b. Edit event — open drawer, modify fields, save
- [x] 6c. Delete event — confirmation dialog
- [x] 6d. Calendar sidebar — toggle calendar visibility *(issue: H5)*
- [x] 6e. Calendar management — create, rename, delete, color
- [x] 6f. Meet-with overlay — search people, show availability
- [x] 6g. Google Calendar sync — connect, disconnect, sync status

## Section 7: Events — Project List & Creation
- [x] 7a. Event project list — filters, search, empty state *(issue: M3)*
- [x] 7b. Create event project — form, school assignment
- [x] 7c. Event project card — status badges, quick actions

## Section 8: Events — Project Detail Tabs
- [x] 8a. Overview tab — summary, status, dates *(issues: H6, H7)*
- [x] 8b. Schedule tab — blocks, drag reorder, add/edit/delete *(issue: M4)*
- [x] 8c. Budget tab — line items, revenue, totals
- [x] 8d. People tab — team members, add/remove, roles
- [x] 8e. Compliance tab — checklist items, assign, complete *(implemented as Documents tab sub-tab)*
- [x] 8f. Groups tab — create groups, assign members *(issues: H8; implemented as Logistics tab)*
- [x] 8g. Check-in tab — scan, manual check-in *(only in Day-Of mode, not main detail page)*
- [x] 8h. Announcements tab — create, send *(implemented in Comms tab)*
- [x] 8i. Chat/presence — real-time messages *(implemented as EventChatDrawer side panel)*

## Section 9: Events — Registration & Sharing
- [x] 9a. Registration form builder — add/edit/reorder fields *(issue: M7)*
- [x] 9b. Share hub — copy link, QR code, open/close window *(issue: M8)*
- [x] 9c. Registration management — view registrants, cancel, balance *(issue: M9)*
- [x] 9d. Public registration page — form fill, payment *(strong security: Turnstile, rate limiting, server-side validation)*

## Section 10: Events — Series, Templates & Approval
- [x] 10a. Event series — create recurring, RRULE config *(issues: C3, M10 — API only, no UI)*
- [x] 10b. Templates — create, apply to new project *(issues: M11, M12)*
- [x] 10c. Approval flow — submit, approve/reject, notifications *(issues: C4, H9, M13)*

## Section 11: IT Help Desk — Dashboard & Tickets
- [x] 11a. IT dashboard — stats cards, recent activity
- [x] 11b. Ticket board (Kanban) — drag between columns, filters *(issue: M14)*
- [x] 11c. Ticket list view — sort, filter, search
- [x] 11d. Create ticket — manual form, issue type, priority, location
- [x] 11e. Create ticket — AI intake chat flow
- [x] 11f. Ticket detail drawer — view all fields

## Section 12: IT Help Desk — Ticket Actions
- [x] 12a. Change status — transitions, hold reason, resolution note
- [x] 12b. Assign ticket — search user, select *(issue: M15)*
- [x] 12c. Add comment — text, internal toggle
- [x] 12d. Upload photos *(issue: H10 — NOT IMPLEMENTED, schema only)*
- [x] 12e. Cancel ticket — reason required
- [x] 12f. Close ticket — resolution note

## Section 13: IT Help Desk — Config
- [x] 13a. Magic links — generate, copy, email, expire
- [x] 13b. Routing — strategy picker, category config, fallback
- [x] 13c. Forms tab — category field editor, add/remove/reorder *(issue: L6)*
- [x] 13d. QR codes — create, toggle active, regenerate, print

## Section 14: IT — Device Management
- [x] 14a. Device list — filters, search, bulk actions
- [x] 14b. Create device — form fields, location picker
- [x] 14c. Device detail drawer — specs, assignment history
- [x] 14d. Assign device — to student or user
- [x] 14e. Unassign device
- [x] 14f. Delete device — confirmation

## Section 15: IT — Student Management
- [x] 15a. Student list — search, filter by grade/status/school
- [x] 15b. Create student — form fields
- [x] 15c. Student detail drawer — info, device assignments
- [x] 15d. Delete student — confirmation

## Section 16: IT — Loaners & Deployment
- [x] 16a. Loaner checkout — select device, assign student, due date
- [x] 16b. Loaner checkin — return device
- [x] 16c. Deployment batch — create, set type/school/grade
- [x] 16d. Deployment batch detail — process items, assign students, auto-populate
- [x] 16e. Deployment batch status transitions

## Section 17: IT — Summer & Provisioning
- [x] 17a. Summer mode toggle *(issue: M16 — API exists, no UI button)*
- [x] 17b. Summer batch — create, start, complete
- [x] 17c. Summer batch detail — mark devices, repair queue
- [x] 17d. Vendor repair dialog — log vendor info
- [x] 17e. Provisioning tab — config toggles, resolve orphaned *(issue: H11 — disabled, no real integration)*

## Section 18: IT — Compliance & Security
- [x] 18a. E-Rate — document archive, generate doc package
- [x] 18b. Content filters — platform config, event disposition
- [x] 18c. Security incidents — create, status change, close with resolution
- [x] 18d. Intelligence tab — analyze, detect, save config

## Section 19: IT — Sync & Integrations
- [x] 19a. Sync tab — Clever/ClassLink, trigger sync, enable/disable
- [x] 19b. Sync status — job history, error reporting

## Section 20: Maintenance — Dashboard & Work Orders
- [x] 20a. Maintenance dashboard — stats, recent activity
- [x] 20b. Work orders board — claim, assign, status change
- [x] 20c. Work orders list — sort, filter
- [x] 20d. Create ticket — form, category, priority, location, photos *(issue: C5 — localStorage auth)*

## Section 21: Maintenance — Ticket Detail
- [x] 21a. Ticket detail page — all fields, status badge
- [x] 21b. Status transitions — each state change
- [x] 21c. Assign technician — dropdown
- [x] 21d. Activity feed — comments, internal notes
- [x] 21e. Photo gallery — upload, view
- [x] 21f. Labor entries — add, delete *(issue: M18)*
- [x] 21g. Cost entries — add, delete
- [x] 21h. Watchers — add, remove
- [x] 21i. Cancel ticket — reason *(issue: M17)*
- [x] 21j. Complete ticket — completion note, photos

## Section 22: Maintenance — PM & Assets
- [x] 22a. PM Calendar — month/week/day/agenda views
- [x] 22b. Create PM schedule — wizard (drawer)
- [x] 22c. PM schedule list view
- [x] 22d. Asset list — search, filter
- [x] 22e. Asset create drawer — form fields
- [x] 22f. Asset detail — specs, PM history, QR code

## Section 23: Maintenance — Compliance
- [x] 23a. Compliance setup wizard — categories, items
- [x] 23b. Compliance calendar — view due dates
- [x] 23c. Compliance record drawer — log completion, attach docs
- [x] 23d. Knowledge base — create/edit articles

## Section 24: Athletics — Dashboard & Teams
- [x] 24a. Athletics dashboard — stats, upcoming, standings
- [x] 24b. Onboarding — first sport/team setup
- [x] 24c. Teams section — list, create, edit, delete
- [x] 24d. Team detail — roster management
- [x] 24e. Add/remove players

## Section 25: Athletics — Schedule & Games
- [x] 25a. Schedule section — calendar + list views
- [x] 25b. Create game — home/away, opponent, location
- [x] 25c. Game drawer — edit details, score entry
- [x] 25d. Dual-school viewpoint flip *(tested with unit tests)*
- [x] 25e. Create practice — time, location
- [x] 25f. Practice drawer — edit details *(issue: H12 — edit mode not wired)*

## Section 26: Athletics — Tournaments & Analytics
- [x] 26a. Tournaments — create, bracket type
- [x] 26b. Tournament detail — matchups, results
- [x] 26c. Stats/analytics tab
- [x] 26d. Board report generation *(issue: H13 — NOT IMPLEMENTED)*

## Section 27: Inventory
- [x] 27a. Inventory list — search, filter, empty state *(issue: M19)*
- [x] 27b. AV equipment wizard — create (3-step) *(issue: H14 — actually 2-step)*
- [x] 27c. AV equipment wizard — edit
- [x] 27d. Item detail — locations, serial numbers, docs
- [x] 27e. Checkout / checkin flow *(issues: M20, L9)*

## Section 28: Planning
- [x] 28a. Planning seasons list — create, status
- [x] 28b. Submissions — submit, view status *(issue: M23)*
- [x] 28c. Approval workflow — approve/reject *(issues: M21, M22)*

## Section 29: Settings — Profile
- [x] 29a. Avatar — upload, remove, crop *(issue: L11 — no crop tool)*
- [x] 29b. Name — edit first/last, save
- [x] 29c. Email — display (read-only)
- [x] 29d. Change password — current + new + confirm
- [x] 29e. Two-factor (TOTP) — enable, QR scan, verify, backup codes *(issue: L12)*
- [x] 29f. Two-factor (TOTP) — disable with password
- [x] 29g. Passkeys — add passkey, browser prompt
- [x] 29h. Passkeys — rename, delete
- [x] 29i. Notification preferences — toggles per category

## Section 30: Settings — Roles & Permissions
- [x] 30a. Roles list — system roles, custom roles
- [x] 30b. Create role — name, permissions checkboxes
- [x] 30c. Edit role — modify permissions
- [x] 30d. Delete role — confirmation, reassign users
- [x] 30e. Permissions matrix — view all permissions

## Section 31: Settings — Teams & Members
- [x] 31a. Teams list — create, rename, delete
- [x] 31b. Team members — add, remove
- [x] 31c. Members list — search, filter by role/status/team
- [x] 31d. Invite member — email, role, team
- [x] 31e. Edit member drawer — name, role, teams
- [x] 31f. Member permissions drawer — view effective permissions
- [x] 31g. Toggle member status — activate/deactivate
- [x] 31h. Remove member — confirmation

## Section 32: Settings — Campus & Facilities
- [x] 32a. Campus selector — switch view
- [x] 32b. Buildings — create, edit, delete
- [x] 32c. Spaces (areas) — create, edit, delete within building
- [x] 32d. Rooms — create, edit, delete within space
- [x] 32e. Map data — if applicable *(Leaflet interactive map with building placement)*
- [x] 32f. School-grouped facilities view

## Section 33: Settings — Schools & Academic Calendar
- [x] 33a. Schools list — create, edit, delete
- [x] 33b. School info tab — principal, address, grade range
- [x] 33c. Academic years — create, edit, delete, set current
- [x] 33d. Terms — create within year, edit, delete
- [x] 33e. Marking periods — create within term
- [x] 33f. Bell schedules — create, edit periods, set default
- [x] 33g. Special days — create, edit, delete
- [x] 33h. Day schedule assignments

## Section 34: Settings — Admin
- [x] 34a. Approval rules — conditional rules, default, always-required
- [x] 34b. Add-ons/modules — enable, disable, per-campus toggle
- [x] 34c. Integrations — status, connect/disconnect
- [x] 34d. Billing — plan details, change plan, cancel
- [x] 34e. Audit log — view entries, filters
- [x] 34f. Security settings — MFA enforcement toggle
- [x] 34g. Compliance settings — DPA tracking, COPPA
