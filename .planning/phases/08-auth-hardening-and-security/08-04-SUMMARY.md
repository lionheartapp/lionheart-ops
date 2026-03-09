---
phase: 08-auth-hardening-and-security
plan: "04"
subsystem: security
tags: [xss-sanitization, file-upload-validation, webhook-verification, input-sanitization, hmac-sha256]
dependency_graph:
  requires: []
  provides: [input-sanitization-framework, file-upload-validation, webhook-signature-verification]
  affects: [tickets-api, events-api, maintenance-upload-routes, settings-upload-routes, stripe-webhook, clever-webhook, classlink-webhook]
tech_stack:
  added: []
  patterns: [regex-html-sanitizer, hmac-sha256-timing-safe, zod-transform-sanitize, mime-type-allowlist]
key_files:
  created:
    - src/lib/sanitize.ts
    - src/lib/validation/file-upload.ts
    - src/lib/webhook-verify.ts
  modified:
    - src/lib/services/ticketService.ts
    - src/lib/services/eventService.ts
    - src/app/api/maintenance/tickets/upload-url/route.ts
    - src/app/api/maintenance/assets/upload-url/route.ts
    - src/app/api/maintenance/tickets/[id]/cost-upload-url/route.ts
    - src/app/api/settings/campus/images/route.ts
    - src/app/api/settings/branding/upload/route.ts
    - src/app/api/webhooks/clever/route.ts
    - src/app/api/webhooks/classlink/route.ts
    - src/app/api/platform/webhooks/stripe/route.ts
decisions:
  - "Regex-based sanitizer (no DOMPurify): avoids ~60KB DOM shim dependency, sufficient for server-side defense-in-depth"
  - "Graceful degradation for Clever/ClassLink webhooks: log warning if secret not configured, skip verification rather than hard-fail (allows integration without secret during dev)"
  - "Stripe: STRIPE_WEBHOOK_SECRET missing returns 500 (not graceful) because it is a required production config, not an optional integration"
  - "Zod .transform() placed after min/max validators: validation runs on raw input before sanitization, preserving accurate error messages"
  - "size: 0 in signed-URL routes: MIME validation is the primary guard; actual size is enforced by Supabase Storage limits on the signed upload"
metrics:
  duration: "3m 34s"
  completed: "2026-03-09"
  tasks_completed: 3
  files_created: 3
  files_modified: 10
---

# Phase 8 Plan 04: Input Sanitization, File Upload Validation, and Webhook Signature Verification Summary

**One-liner:** Server-side XSS sanitization via regex HTML stripper wired into Zod schemas, MIME-type allowlist validation on all 5 upload routes, and HMAC-SHA256 timing-safe signature verification on Stripe/Clever/ClassLink webhooks.

## What Was Built

### Task 1: Input Sanitization Utility + File Upload Validation

**`src/lib/sanitize.ts`**
- `sanitizeHtml(input)`: strips `<script>`, `<style>`, `<iframe>`, `<embed>`, `<object>`, `<form>`, `<input>` tags and content; removes all `on*` event handler attributes; removes `javascript:` and `data:` URIs; preserves safe tags (`p`, `br`, `b`, `i`, `strong`, `em`, `ul`, `ol`, `li`, `a`, `h1-h6`) with safe attributes only
- `stripAllHtml(input)`: removes all HTML tags — for plain-text fields (titles, names)
- `zodSanitizedString()`: Zod factory returning `z.string().transform(stripAllHtml)`
- `zodRichText()`: Zod factory returning `z.string().transform(sanitizeHtml)`

**`src/lib/validation/file-upload.ts`**
- `ALLOWED_IMAGE_TYPES`: `Set<string>` of `image/jpeg`, `image/png`, `image/webp`, `image/gif`
- `ALLOWED_DOCUMENT_TYPES`: images + `application/pdf`
- `MAX_FILE_SIZE_BYTES`: 10MB default
- `validateFileUpload(file, options)`: checks MIME type against allowlist; checks size when >0; returns descriptive error like `"File type 'application/exe' is not allowed. Accepted: JPEG, PNG, WEBP, GIF"`
- `validateMultipleFiles(files, options)`: batch validation returning first failure

### Task 2: Webhook Signature Verification

**`src/lib/webhook-verify.ts`**
- `verifyHmacSha256(payload, signature, secret)`: HMAC-SHA256 with `crypto.timingSafeEqual` for timing-attack resistance; handles hex-encoded signatures; returns false on any error

**Stripe webhook** (`/api/platform/webhooks/stripe`):
- Checks `stripe-signature` header; returns 401 if missing
- Returns 500 if `STRIPE_WEBHOOK_SECRET` not configured (required in production)
- Parses `t=<timestamp>,v1=<hex>` format, verifies HMAC of `<timestamp>.<rawBody>`

**Clever webhook** (`/api/webhooks/clever`):
- Reads raw body before JSON.parse (stream consumed once)
- Checks `x-clever-signature` or `clever-signature` headers
- Graceful degradation: warns and skips if `CLEVER_WEBHOOK_SECRET` not set

**ClassLink webhook** (`/api/webhooks/classlink`):
- Same pattern as Clever using `CLASSLINK_WEBHOOK_SECRET` and `x-classlink-signature`/`classlink-signature`

### Task 3: Wire Sanitization + Validation into Application Code

**Zod schema sanitization:**
- `ticketService.ts` — `CreateTicketSchema` and `UpdateTicketSchema`: `title`, `description`, `locationText` now use `.transform(stripAllHtml)`
- `eventService.ts` — `CreateEventSchema`: `title`, `description`, `room` use `.transform(stripAllHtml)`

**File upload validation (all 5 routes):**
- `maintenance/tickets/upload-url`: `validateFileUpload` on `contentType` before signed URL generation
- `maintenance/assets/upload-url`: same pattern
- `maintenance/tickets/[id]/cost-upload-url`: same pattern (receipt photos)
- `settings/campus/images`: `validateFileUpload` replaces manual `fileBuffer.length > MAX_FILE_SIZE` check (5MB, image types)
- `settings/branding/upload`: `validateFileUpload` with `ALLOWED_BRANDING_TYPES` (images + SVG, 5MB)

## Deviations from Plan

None - plan executed exactly as written.

### Pre-existing TypeScript Errors (Out of Scope)

Discovered during verification that `src/lib/email/templates.ts` has pre-existing errors (`password_reset` template missing from `SUBJECTS` and `TEXT_BODIES` records). These are unrelated to this plan and logged to deferred-items.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `8f76d0c` | feat(08-04): add input sanitization and file upload validation utilities |
| 2 | `58a12b5` | feat(08-04): add webhook signature verification for Stripe, Clever, and ClassLink |
| 3 | `9765047` | feat(08-04): wire sanitization and file upload validation into schemas and routes |

## Self-Check: PASSED

Files exist:
- `src/lib/sanitize.ts` — FOUND
- `src/lib/validation/file-upload.ts` — FOUND
- `src/lib/webhook-verify.ts` — FOUND
- All 10 modified files confirmed via git diff

Commits verified:
- `8f76d0c` — FOUND
- `58a12b5` — FOUND
- `9765047` — FOUND

Grep checks passed:
- `stripAllHtml` wired into ticketService.ts (3 fields) and eventService.ts (3 fields)
- `validateFileUpload` wired into all 5 upload routes
- `verifyHmacSha256` wired into all 3 webhook routes
- `stripe-signature` header check present in Stripe route
