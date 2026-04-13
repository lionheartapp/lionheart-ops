---
aliases: [AI, Gemini, AI Provider]
tags: [architecture, ai, gemini]
created: 2026-04-08
---

# AI Provider: Google Gemini

All AI features use `@google/genai` with model `gemini-2.0-flash`. The `@anthropic-ai/sdk` has been removed.

**Env var:** `GEMINI_API_KEY` (already set on Vercel). All services check `GEMINI_API_KEY || NEXT_PUBLIC_GEMINI_API_KEY`.

## AI Services (all Gemini)

| Service File | Purpose | Notes |
|-------------|---------|-------|
| `gemini.service.ts` | Event parsing, description generation | Core service |
| `building-outline.service.ts` | Satellite image building detection | Vision API |
| `maintenance-ai.service.ts` | Ticket photo diagnosis + follow-up conversation | Vision API |
| `itAIDiagnosticService.ts` | IT ticket/device diagnostics | See [[IT Help Desk]] |
| `itBoardReportService.ts` | IT board report narrative | See [[IT Help Desk]] |
| `itDeviceIntelligenceService.ts` | Repair/replace recommendations | See [[MDM and Roster]] |
| `schoolLookupService.ts` | Website data extraction | Onboarding |
| `boardReportService.ts` | Facilities board report narrative | Maintenance module |
| `repeatRepairService.ts` | Asset replace-vs-repair recommendations | Maintenance module |
| `assistant-tools.ts` | AI chatbot tool definitions | Gemini function calling format |
| `assistant/chat/route.ts` | AI chatbot endpoint | Gemini function calling loop |

## Chatbot UI

All chatbot [[Components#AI Chat (15 files)|components]] kept as-is: `src/components/ai/*`, `assistant.service.ts`, `src/lib/types/assistant.ts`.

## API Routes

See [[API Routes#AI (9)]] for the full list of AI endpoints.
