# Requirements: Lionheart Platform

**Defined:** 2026-03-05 (v1.0), 2026-03-08 (v2.0)
**Core Value:** Schools can manage their entire operational workflow in one unified platform with role-based access, multi-campus support, and AI-assisted features.

## v2.0 Requirements

Requirements for Launch Readiness milestone. Each maps to roadmap phases.

### Authentication & Security

- [x] **AUTH-01**: User can reset their password via a "Forgot Password" email link with secure token
- [x] **AUTH-02**: Login endpoint enforces rate limiting (max 5 attempts per 15 minutes per IP)
- [x] **AUTH-03**: All public endpoints enforce rate limiting (configurable per-route)
- [x] **AUTH-04**: JWT tokens are stored in httpOnly secure cookies instead of localStorage
- [x] **AUTH-05**: All state-changing API requests include CSRF protection
- [x] **AUTH-06**: All user-submitted text fields are sanitized against XSS before storage
- [x] **AUTH-07**: Stripe webhook endpoint verifies request signatures before processing
- [x] **AUTH-08**: Clever and ClassLink webhook endpoints verify request signatures
- [x] **AUTH-09**: User receives email verification link after signup and must verify before full access
- [x] **AUTH-10**: Password creation enforces complexity rules (uppercase, number, special character, 8+ chars)
- [x] **AUTH-11**: File uploads validate file size limits and MIME types before processing

### Landing & Marketing Pages

- [x] **PAGE-01**: Visitors can view a Privacy Policy page compliant with COPPA/FERPA for K-12 schools
- [x] **PAGE-02**: Visitors can view a Terms of Service page governing platform usage
- [x] **PAGE-03**: Visitors can view a Pricing page showing plans and costs before signup
- [x] **PAGE-04**: Visitors can view an About page with company information and a Contact form
- [x] **PAGE-05**: All footer links navigate to real pages (Features, Pricing, About, Contact, Privacy, Terms)
- [x] **PAGE-06**: "Coming soon" OAuth buttons on signup are hidden or replaced with a clean non-OAuth flow

### Inventory System

- [x] **INV-01**: Admin can create, update, and delete inventory items with name, category, SKU, and quantity
- [x] **INV-02**: Staff can check out an inventory item and the system records who, when, and expected return
- [x] **INV-03**: Staff can check in a returned inventory item and the system updates available quantity
- [x] **INV-04**: Admin can view full transaction history (checkout/checkin log) for any inventory item
- [x] **INV-05**: System alerts admin when item quantity falls below configured reorder threshold
- [x] **INV-06**: Admin can view and manage inventory through a dedicated UI page with search and filters

### Calendar & Events

- [x] **CAL-01**: Admin can GET, PUT, and DELETE individual draft events via `/api/draft-events/[id]`
- [x] **CAL-02**: System prevents booking two events for the same room at the same time (conflict detection)

### Tickets

- [ ] **TIX-01**: Dashboard ticket drawer edit button navigates to ticket edit view
- [x] **TIX-02**: Generic tickets support comments and file attachments
- [x] **TIX-03**: Users can search tickets by keyword across title and description

### Settings & Admin

- [ ] **SET-01**: Admin can view audit log history through a dedicated UI in Settings
- [ ] **SET-02**: Org admin can view and manage their billing/subscription plan
- [ ] **SET-03**: Admin can export users, tickets, and events as CSV files
- [ ] **SET-04**: Admin can edit organization name and subdomain slug after initial signup
- [ ] **SET-05**: Users can configure which email/in-app notifications they receive

### Infrastructure

- [ ] **INFRA-01**: Critical API routes have Vitest unit tests covering happy path and error cases
- [ ] **INFRA-02**: GitHub Actions CI pipeline runs tests, linting, and type-check on every PR
- [ ] **INFRA-03**: Application uses structured JSON logging (Pino) with log levels instead of console.error
- [ ] **INFRA-04**: Runtime errors are captured and reported to Sentry with context
- [ ] **INFRA-05**: All list API endpoints support cursor-based or offset pagination with configurable page size
- [ ] **INFRA-06**: Complex multi-model operations use database transactions instead of sequential awaits

## v1.0 Requirements (Complete)

All 101 requirements from v1.0 Maintenance & Facilities Module — completed 2026-03-06.

<details>
<summary>v1.0 requirement categories (all complete)</summary>

- Schema & Foundation (SCHEMA-01 through SCHEMA-07) — Phase 1
- Module & Navigation (NAV-01 through NAV-04) — Phase 1
- Ticket Submission (SUBMIT-01 through SUBMIT-11) — Phase 2
- Ticket Lifecycle (LIFE-01 through LIFE-08) — Phase 2
- Ticket Detail (DETAIL-01 through DETAIL-05) — Phase 2
- Specialty Routing (ROUTE-01 through ROUTE-05) — Phase 2
- Notifications (NOTIF-01 through NOTIF-11) — Phase 2
- Kanban Board (BOARD-01 through BOARD-08) — Phase 3
- AI Diagnostics (AI-01 through AI-08) — Phase 3
- Asset Register (ASSET-01 through ASSET-06) — Phase 4
- QR Codes (QR-01 through QR-05) — Phase 4
- Preventive Maintenance (PM-01 through PM-10) — Phase 4
- Labor & Cost Tracking (LABOR-01 through LABOR-07) — Phase 4
- Analytics Dashboard (ANALYTICS-01 through ANALYTICS-08) — Phase 5
- Repeat Repair Detection (REPAIR-01 through REPAIR-04) — Phase 5
- Compliance Calendar (COMPLY-01 through COMPLY-08) — Phase 6
- Board Reporting (REPORT-01 through REPORT-10) — Phase 6
- Knowledge Base (KB-01 through KB-06) — Phase 7
- Offline PWA (OFFLINE-01 through OFFLINE-09) — Phase 7

</details>

## v2.1 Requirements

Deferred to next minor release. Tracked but not in current roadmap.

### Authentication & Identity

- **AUTH-20**: User can enable 2FA/MFA via TOTP authenticator app
- **AUTH-21**: User can sign in with Google OAuth
- **AUTH-22**: User can sign in with Microsoft OAuth
- **AUTH-23**: User can view active sessions and revoke any session
- **AUTH-24**: User can choose "Remember Me" for extended session vs. shorter default
- **AUTH-25**: User can request account deletion (GDPR compliance)

### Scalability

- **SCALE-01**: Permission cache uses distributed store (Redis) instead of in-memory
- **SCALE-02**: Email, AI, and sync operations run via async job queue (not synchronous)
- **SCALE-03**: API documentation auto-generated via OpenAPI/Swagger spec

### Module Polish

- **MOD-01**: Athletics supports CSV roster import
- **MOD-02**: Athletics has embeddable public schedule widget
- **MOD-03**: Maintenance work orders have print-friendly view
- **MOD-04**: Bulk user import via CSV upload
- **MOD-05**: IT device lifecycle has formal state machine engine

## Out of Scope

| Feature | Reason |
|---------|--------|
| Vendor portal / contractor login | Deferred to post-v2; new role type needed |
| SIS integration / auto-provisioning | Depends on OAuth/SSO work in v2.1 |
| Budget integration (Munis/Tyler) | ERP integration is significant effort; future milestone |
| Dashboard widget customization | Low priority — fixed layout serves current needs |
| Weather widget location fix | Low priority — cosmetic issue |
| Custom fields per event category | Low complexity benefit |
| SLA tracking for tickets | Requires baseline metrics first — defer to v2.1+ |
| API documentation (OpenAPI) | Deferred to v2.1 with formal API versioning |
| Smart Event AI feature | Deferred until core event model stabilized |
| Native mobile app | PWA covers mobile needs |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 8 | Complete |
| AUTH-02 | Phase 8 | Complete |
| AUTH-03 | Phase 8 | Complete |
| AUTH-04 | Phase 8 | Complete |
| AUTH-05 | Phase 8 | Complete |
| AUTH-06 | Phase 8 | Complete |
| AUTH-07 | Phase 8 | Complete |
| AUTH-08 | Phase 8 | Complete |
| AUTH-09 | Phase 8 | Complete |
| AUTH-10 | Phase 8 | Complete |
| AUTH-11 | Phase 8 | Complete |
| PAGE-01 | Phase 9 | Complete |
| PAGE-02 | Phase 9 | Complete |
| PAGE-03 | Phase 9 | Complete |
| PAGE-04 | Phase 9 | Complete |
| PAGE-05 | Phase 9 | Complete |
| PAGE-06 | Phase 9 | Complete |
| INV-01 | Phase 10 | Complete |
| INV-02 | Phase 10 | Complete |
| INV-03 | Phase 10 | Complete |
| INV-04 | Phase 10 | Complete |
| INV-05 | Phase 10 | Complete |
| INV-06 | Phase 10 | Complete |
| CAL-01 | Phase 11 | Complete |
| CAL-02 | Phase 11 | Complete |
| TIX-01 | Phase 11 | Pending |
| TIX-02 | Phase 11 | Complete |
| TIX-03 | Phase 11 | Complete |
| SET-01 | Phase 12 | Pending |
| SET-02 | Phase 12 | Pending |
| SET-03 | Phase 12 | Pending |
| SET-04 | Phase 12 | Pending |
| SET-05 | Phase 12 | Pending |
| INFRA-01 | Phase 13 | Pending |
| INFRA-02 | Phase 13 | Pending |
| INFRA-03 | Phase 13 | Pending |
| INFRA-04 | Phase 13 | Pending |
| INFRA-05 | Phase 13 | Pending |
| INFRA-06 | Phase 13 | Pending |

**Coverage:**
- v2.0 requirements: 33 total
- Mapped to phases: 33
- Unmapped: 0

---
*Requirements defined: 2026-03-05 (v1.0), 2026-03-08 (v2.0)*
*Last updated: 2026-03-08 after v2.0 roadmap creation*
