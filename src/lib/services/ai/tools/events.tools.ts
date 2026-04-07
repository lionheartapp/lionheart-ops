/**
 * AI Assistant — Events Domain Tools
 *
 * Barrel file that registers all events tools via side-effect imports.
 * Sub-modules (each calls registerTools independently):
 *   - events-read.tools.ts    — GREEN tier (read-only queries)
 *   - events-write.tools.ts   — ORANGE tier (draft/confirmation mutations)
 *   - events-danger.tools.ts  — RED/YELLOW tier (destructive & immediate actions)
 */

import './events-read.tools'
import './events-write.tools'
import './events-danger.tools'
