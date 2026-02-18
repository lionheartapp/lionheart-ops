# VITE_* usage audit

Audit of all references to `VITE` in the codebase. The app runs on **Next.js**; Vite-style `import.meta.env.VITE_*` is not reliably available and can cause runtime errors (e.g. `Cannot read properties of undefined (reading 'VITE_ORG_NAME')`). Prefer **`process.env.NEXT_PUBLIC_*`** for client-visible env vars.

---

## 1. Runtime code – env reads (should migrate)

| File | Line(s) | Current | Recommendation | Status |
|------|--------|--------|----------------|--------|
| **platform/src/lionheart/components/GlobalErrorBoundary.jsx** | 37 | `import.meta.env?.VITE_ORG_NAME?.trim()` (already guarded) | Keep optional chaining; prefer `process.env.NEXT_PUBLIC_ORG_NAME` first. | ✅ Fixed |
| **platform/src/lionheart/pages/LandingPage.jsx** | 6 | `import.meta.env?.VITE_PLATFORM_URL` then `process.env.NEXT_PUBLIC_PLATFORM_URL` | Safe (optional chaining). Could drop VITE fallback and use only `NEXT_PUBLIC_PLATFORM_URL`. | ✅ No change needed |
| **platform/src/lionheart/services/gemini.js** | 92, 157, 271, 394 | `import.meta.env.VITE_GEMINI_API_KEY` | Use safe getter with NEXT_PUBLIC + VITE fallback. | ✅ Fixed (getGeminiApiKey()) |
| **src/services/gemini.js** | 115, 186, 300, 423 | Same as above | Same as above. | ✅ Fixed (getGeminiApiKey()) |
| **src/components/GlobalErrorBoundary.jsx** | 35 | `import.meta.env.VITE_ORG_NAME` | Same pattern as platform (optional chaining + NEXT_PUBLIC fallback). | ✅ Fixed |
| **platform/src/lib/tenant.ts** | 14–15 | `process.env.VITE_ORG_NAME`, `process.env.VITE_ORG_WEBSITE` | Prefer NEXT_PUBLIC_* then VITE as fallback. | ✅ Fixed |
| **src/lib/tenant.ts** | 14–15 | Same | Same. | ✅ Fixed |

---

## 2. Runtime code – error / UI strings only (no env read)

These only *mention* `VITE_GEMINI_API_KEY` in user-facing error text. Safe to change copy to a generic name so docs and .env can standardize on `NEXT_PUBLIC_GEMINI_API_KEY`.

| File | Line(s) | Current | Recommendation | Status |
|------|--------|--------|----------------|--------|
| platform/src/lionheart/components/FormBuilder.jsx | 1042–1043 | Error message: "Add VITE_GEMINI_API_KEY in .env…" | Use "Add NEXT_PUBLIC_GEMINI_API_KEY (or VITE_GEMINI_API_KEY)…" | ✅ Fixed |
| platform/src/lionheart/components/AIFormModal.jsx | 191–192 | Same | Same. | ✅ Fixed |
| platform/src/lionheart/components/SmartEventModal.jsx | 819–820 | Same | Same. | ✅ Fixed |
| src/components/FormBuilder.jsx | 985–986 | Same | Same. | ✅ Fixed |
| src/components/SmartEventModal.jsx | 819–820 | Same | Same. | ✅ Fixed |
| src/components/AIFormModal.jsx | 191–192 | Same | Same. | ✅ Fixed |

---

## 3. Comments / documentation in code

| File | Line(s) | Note | Status |
|------|--------|------|--------|
| platform/src/lionheart/config/orgContext.js | 6 | Comment lists VITE_*. Update to NEXT_PUBLIC_* (or legacy VITE_*). | ✅ Fixed |

---

## 4. Docs only (no code behavior change)

Update these to recommend Next.js env vars and mention VITE only as legacy.

| File | References |
|------|------------|
| docs/SAAS_AUDIT_REPORT.md | VITE_GEMINI_API_KEY in env list |
| docs/VERCEL_DEPLOY_NOW.md | VITE_PLATFORM_URL, VITE_CURRENT_ORG_ID, VITE_ORG_NAME, VITE_GEMINI_API_KEY |
| docs/SAAS_FOUNDATION_CHANGES.md | VITE_ORG_NAME, VITE_ORG_WEBSITE, fetch(VITE_PLATFORM_URL) |
| docs/SAAS_PRODUCT_ROADMAP.md | VITE_ORG_NAME |
| docs/TROUBLESHOOTING.md | VITE_PLATFORM_URL, VITE_CURRENT_ORG_ID, VITE_ORG_NAME, VITE_GEMINI_API_KEY |
| docs/VERCEL_DEPLOYMENT.md | VITE_* table |
| docs/SETUP_FROM_SCRATCH.md | VITE_* list |
| docs/GEMINI_GEM_CONTEXT.md | VITE_PLATFORM_URL, VITE_ORG_*, VITE_GEMINI_API_KEY |

---

## Summary

- **Fix first (runtime crashes):**  
  - `platform/src/lionheart/services/gemini.js` – use optional chaining and/or `NEXT_PUBLIC_GEMINI_API_KEY`.  
  - `src/services/gemini.js` – same.  
  - `src/components/GlobalErrorBoundary.jsx` – same pattern as platform GlobalErrorBoundary (safe env read + fallback).
- **Then:** Update error strings and comments to reference `NEXT_PUBLIC_GEMINI_API_KEY` (and other `NEXT_PUBLIC_*` / `ORG_*` vars) instead of VITE_*.
- **Lastly:** Update docs to recommend Next.js env vars; keep VITE_* only as legacy in one place if needed.

Suggested **env var mapping** for Next.js:

| Old (Vite) | Prefer (Next.js) |
|------------|-------------------|
| VITE_PLATFORM_URL | NEXT_PUBLIC_PLATFORM_URL |
| VITE_CURRENT_ORG_ID | NEXT_PUBLIC_CURRENT_ORG_ID |
| VITE_ORG_NAME | NEXT_PUBLIC_ORG_NAME |
| VITE_ORG_WEBSITE | NEXT_PUBLIC_ORG_WEBSITE |
| VITE_GEMINI_API_KEY | NEXT_PUBLIC_GEMINI_API_KEY (if key is used in browser) or GEMINI_API_KEY (server-only) |
