# Lionheart Platform — Full Site Audit Plan

**Purpose:** Walk through every click, save, and create in the app to verify functionality, evaluate UX, and identify UI improvements.

**Status:** Not started
**Last updated:** April 23, 2026
**Total sections:** 34
**Total checkpoints:** ~180

---

## How to Use This Document

For each checkpoint:
- [ ] **Works** — functionality is correct
- [ ] **UX** — flow makes sense, no confusion points
- [ ] **UI** — visuals are polished, consistent with design system
- Note any issues inline under the checkpoint

---

## Section 1: Public Pages
- [ ] 1a. Landing page — hero, features, pricing link, CTA buttons
- [ ] 1b. Pricing page — tiers, feature comparison, CTA
- [ ] 1c. Terms / Privacy pages
- [ ] 1d. Signup — form validation, org creation, redirect

## Section 2: Auth Flow
- [ ] 2a. Login — email/password, error states, org lookup
- [ ] 2b. Login — MFA TOTP code entry
- [ ] 2c. Login — MFA passkey prompt
- [ ] 2d. Login — backup code fallback
- [ ] 2e. Forgot password — request email
- [ ] 2f. Reset password — set new password
- [ ] 2g. Set password — invite link flow
- [ ] 2h. Email verification page

## Section 3: Onboarding
- [ ] 3a. School info setup — name, address, logo, grade levels
- [ ] 3b. Member invite — bulk import, individual invite
- [ ] 3c. Plan selection — free/paid, Stripe checkout
- [ ] 3d. Checklist widget — dismiss items, completion state

## Section 4: Dashboard
- [ ] 4a. Dashboard layout — cards, stats, empty states
- [ ] 4b. Quick action buttons
- [ ] 4c. Notification bell — dropdown, mark read, mark all read
- [ ] 4d. School selector — switch schools, scoped user view
- [ ] 4e. Sidebar — nav links, active states, mobile sheet
- [ ] 4f. User menu — profile link, logout

## Section 5: Calendar — Views
- [ ] 5a. Month view — event dots, click to view
- [ ] 5b. Week view — time slots, event blocks
- [ ] 5c. Day view — hourly layout
- [ ] 5d. Agenda view — list format
- [ ] 5e. Navigation — prev/next, today button, view switcher pill

## Section 6: Calendar — CRUD & Sidebar
- [ ] 6a. Create event — click slot, fill form, save
- [ ] 6b. Edit event — open drawer, modify fields, save
- [ ] 6c. Delete event — confirmation dialog
- [ ] 6d. Calendar sidebar — toggle calendar visibility
- [ ] 6e. Calendar management — create, rename, delete, color
- [ ] 6f. Meet-with overlay — search people, show availability
- [ ] 6g. Google Calendar sync — connect, disconnect, sync status

## Section 7: Events — Project List & Creation
- [ ] 7a. Event project list — filters, search, empty state
- [ ] 7b. Create event project — form, school assignment
- [ ] 7c. Event project card — status badges, quick actions

## Section 8: Events — Project Detail Tabs
- [ ] 8a. Overview tab — summary, status, dates
- [ ] 8b. Schedule tab — blocks, drag reorder, add/edit/delete
- [ ] 8c. Budget tab — line items, revenue, totals
- [ ] 8d. People tab — team members, add/remove, roles
- [ ] 8e. Compliance tab — checklist items, assign, complete
- [ ] 8f. Groups tab — create groups, assign members
- [ ] 8g. Check-in tab — scan, manual check-in
- [ ] 8h. Announcements tab — create, send
- [ ] 8i. Chat/presence — real-time messages

## Section 9: Events — Registration & Sharing
- [ ] 9a. Registration form builder — add/edit/reorder fields
- [ ] 9b. Share hub — copy link, QR code, open/close window
- [ ] 9c. Registration management — view registrants, cancel, balance
- [ ] 9d. Public registration page — form fill, payment

## Section 10: Events — Series, Templates & Approval
- [ ] 10a. Event series — create recurring, RRULE config
- [ ] 10b. Templates — create, apply to new project
- [ ] 10c. Approval flow — submit, approve/reject, notifications

## Section 11: IT Help Desk — Dashboard & Tickets
- [ ] 11a. IT dashboard — stats cards, recent activity
- [ ] 11b. Ticket board (Kanban) — drag between columns, filters
- [ ] 11c. Ticket list view — sort, filter, search
- [ ] 11d. Create ticket — manual form, issue type, priority, location
- [ ] 11e. Create ticket — AI intake chat flow
- [ ] 11f. Ticket detail drawer — view all fields

## Section 12: IT Help Desk — Ticket Actions
- [ ] 12a. Change status — transitions, hold reason, resolution note
- [ ] 12b. Assign ticket — search user, select
- [ ] 12c. Add comment — text, internal toggle
- [ ] 12d. Upload photos
- [ ] 12e. Cancel ticket — reason required
- [ ] 12f. Close ticket — resolution note

## Section 13: IT Help Desk — Config
- [ ] 13a. Magic links — generate, copy, email, expire
- [ ] 13b. Routing — strategy picker, category config, fallback
- [ ] 13c. Forms tab — category field editor, add/remove/reorder
- [ ] 13d. QR codes — create, toggle active, regenerate, print

## Section 14: IT — Device Management
- [ ] 14a. Device list — filters, search, bulk actions
- [ ] 14b. Create device — form fields, location picker
- [ ] 14c. Device detail drawer — specs, assignment history
- [ ] 14d. Assign device — to student or user
- [ ] 14e. Unassign device
- [ ] 14f. Delete device — confirmation

## Section 15: IT — Student Management
- [ ] 15a. Student list — search, filter by grade/status/school
- [ ] 15b. Create student — form fields
- [ ] 15c. Student detail drawer — info, device assignments
- [ ] 15d. Delete student — confirmation

## Section 16: IT — Loaners & Deployment
- [ ] 16a. Loaner checkout — select device, assign student, due date
- [ ] 16b. Loaner checkin — return device
- [ ] 16c. Deployment batch — create, set type/school/grade
- [ ] 16d. Deployment batch detail — process items, assign students, auto-populate
- [ ] 16e. Deployment batch status transitions

## Section 17: IT — Summer & Provisioning
- [ ] 17a. Summer mode toggle
- [ ] 17b. Summer batch — create, start, complete
- [ ] 17c. Summer batch detail — mark devices, repair queue
- [ ] 17d. Vendor repair dialog — log vendor info
- [ ] 17e. Provisioning tab — config toggles, resolve orphaned

## Section 18: IT — Compliance & Security
- [ ] 18a. E-Rate — document archive, generate doc package
- [ ] 18b. Content filters — platform config, event disposition
- [ ] 18c. Security incidents — create, status change, close with resolution
- [ ] 18d. Intelligence tab — analyze, detect, save config

## Section 19: IT — Sync & Integrations
- [ ] 19a. Sync tab — Clever/ClassLink, trigger sync, enable/disable
- [ ] 19b. Sync status — job history, error reporting

## Section 20: Maintenance — Dashboard & Work Orders
- [ ] 20a. Maintenance dashboard — stats, recent activity
- [ ] 20b. Work orders board — claim, assign, status change
- [ ] 20c. Work orders list — sort, filter
- [ ] 20d. Create ticket — form, category, priority, location, photos

## Section 21: Maintenance — Ticket Detail
- [ ] 21a. Ticket detail page — all fields, status badge
- [ ] 21b. Status transitions — each state change
- [ ] 21c. Assign technician — dropdown
- [ ] 21d. Activity feed — comments, internal notes
- [ ] 21e. Photo gallery — upload, view
- [ ] 21f. Labor entries — add, delete
- [ ] 21g. Cost entries — add, delete
- [ ] 21h. Watchers — add, remove
- [ ] 21i. Cancel ticket — reason
- [ ] 21j. Complete ticket — completion note, photos

## Section 22: Maintenance — PM & Assets
- [ ] 22a. PM Calendar — month/week/day/agenda views
- [ ] 22b. Create PM schedule — wizard (drawer)
- [ ] 22c. PM schedule list view
- [ ] 22d. Asset list — search, filter
- [ ] 22e. Asset create drawer — form fields
- [ ] 22f. Asset detail — specs, PM history, QR code

## Section 23: Maintenance — Compliance
- [ ] 23a. Compliance setup wizard — categories, items
- [ ] 23b. Compliance calendar — view due dates
- [ ] 23c. Compliance record drawer — log completion, attach docs
- [ ] 23d. Knowledge base — create/edit articles

## Section 24: Athletics — Dashboard & Teams
- [ ] 24a. Athletics dashboard — stats, upcoming, standings
- [ ] 24b. Onboarding — first sport/team setup
- [ ] 24c. Teams section — list, create, edit, delete
- [ ] 24d. Team detail — roster management
- [ ] 24e. Add/remove players

## Section 25: Athletics — Schedule & Games
- [ ] 25a. Schedule section — calendar + list views
- [ ] 25b. Create game — home/away, opponent, location
- [ ] 25c. Game drawer — edit details, score entry
- [ ] 25d. Dual-school viewpoint flip
- [ ] 25e. Create practice — time, location
- [ ] 25f. Practice drawer — edit details

## Section 26: Athletics — Tournaments & Analytics
- [ ] 26a. Tournaments — create, bracket type
- [ ] 26b. Tournament detail — matchups, results
- [ ] 26c. Stats/analytics tab
- [ ] 26d. Board report generation

## Section 27: Inventory
- [ ] 27a. Inventory list — search, filter, empty state
- [ ] 27b. AV equipment wizard — create (3-step)
- [ ] 27c. AV equipment wizard — edit
- [ ] 27d. Item detail — locations, serial numbers, docs
- [ ] 27e. Checkout / checkin flow

## Section 28: Planning
- [ ] 28a. Planning seasons list — create, status
- [ ] 28b. Submissions — submit, view status
- [ ] 28c. Approval workflow — approve/reject

## Section 29: Settings — Profile
- [ ] 29a. Avatar — upload, remove, crop
- [ ] 29b. Name — edit first/last, save
- [ ] 29c. Email — display (read-only)
- [ ] 29d. Change password — current + new + confirm
- [ ] 29e. Two-factor (TOTP) — enable, QR scan, verify, backup codes
- [ ] 29f. Two-factor (TOTP) — disable with password
- [ ] 29g. Passkeys — add passkey, browser prompt
- [ ] 29h. Passkeys — rename, delete
- [ ] 29i. Notification preferences — toggles per category

## Section 30: Settings — Roles & Permissions
- [ ] 30a. Roles list — system roles, custom roles
- [ ] 30b. Create role — name, permissions checkboxes
- [ ] 30c. Edit role — modify permissions
- [ ] 30d. Delete role — confirmation, reassign users
- [ ] 30e. Permissions matrix — view all permissions

## Section 31: Settings — Teams & Members
- [ ] 31a. Teams list — create, rename, delete
- [ ] 31b. Team members — add, remove
- [ ] 31c. Members list — search, filter by role/status/team
- [ ] 31d. Invite member — email, role, team
- [ ] 31e. Edit member drawer — name, role, teams
- [ ] 31f. Member permissions drawer — view effective permissions
- [ ] 31g. Toggle member status — activate/deactivate
- [ ] 31h. Remove member — confirmation

## Section 32: Settings — Campus & Facilities
- [ ] 32a. Campus selector — switch view
- [ ] 32b. Buildings — create, edit, delete
- [ ] 32c. Spaces (areas) — create, edit, delete within building
- [ ] 32d. Rooms — create, edit, delete within space
- [ ] 32e. Map data — if applicable
- [ ] 32f. School-grouped facilities view

## Section 33: Settings — Schools & Academic Calendar
- [ ] 33a. Schools list — create, edit, delete
- [ ] 33b. School info tab — principal, address, grade range
- [ ] 33c. Academic years — create, edit, delete, set current
- [ ] 33d. Terms — create within year, edit, delete
- [ ] 33e. Marking periods — create within term
- [ ] 33f. Bell schedules — create, edit periods, set default
- [ ] 33g. Special days — create, edit, delete
- [ ] 33h. Day schedule assignments

## Section 34: Settings — Admin
- [ ] 34a. Approval rules — conditional rules, default, always-required
- [ ] 34b. Add-ons/modules — enable, disable, per-campus toggle
- [ ] 34c. Integrations — status, connect/disconnect
- [ ] 34d. Billing — plan details, change plan, cancel
- [ ] 34e. Audit log — view entries, filters
- [ ] 34f. Security settings — MFA enforcement toggle
- [ ] 34g. Compliance settings — DPA tracking, COPPA
