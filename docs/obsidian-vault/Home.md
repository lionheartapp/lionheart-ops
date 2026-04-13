---
aliases: [MOC, Index, Dashboard]
tags: [moc]
created: 2026-04-08
---

# Lionheart Platform — Knowledge Base

> Educational institution management SaaS. Multi-tenant Next.js 15 + Supabase.

---

## Design

- [[UI Design System]] — Aurora gradient, glassmorphism, buttons, drawers, empty states
- [[Animation System]] — Framer Motion variants, CSS keyframes, easing curves

## Architecture

- [[API Routes]] — All 406 routes by feature area
- [[Components]] — Full inventory (~291 files) with reusable shared components
- [[AI Services]] — Gemini provider, all AI service files

## Features

- [[Completed Features]] — Notifications, search, add-ons, athletics, export schedule
- [[IT Help Desk]] — Tickets, devices, magic links, Kanban board
- [[MDM and Roster]] — Device management, student roster, sync, intelligence

## Development

- [[UX Lessons]] — Rules proven across multiple features
- [[DX Improvements]] — withAuth wrapper, component decomposition, test coverage
- [[Pending Plans]] — Future work and known issues

---

## Quick Reference

| Item | Value |
|------|-------|
| Brand gradient | `linear-gradient(90deg, #3B82F6, #6366F1)` |
| Glass class | `ui-glass` (see [[UI Design System#Glassmorphism System (Site-Wide)]]) |
| Button style | `bg-gray-900 text-white rounded-full` |
| Easing | `[0.25, 0.1, 0.25, 1]` (see [[Animation System#Easing]]) |
| AI model | `gemini-2.0-flash` via `@google/genai` (see [[AI Services]]) |
| Dev server | Port 3004 |
| Total API routes | 406 |
| Total components | ~291 `.tsx` files |
