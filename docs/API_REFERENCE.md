# Lionheart Platform API Reference

## Overview
This document describes the main API endpoints and their usage for the Lionheart Platform.

### Authentication
- `POST /api/auth/login` — Authenticate user, returns JWT.
- `POST /api/auth/set-password` — Set or reset password.

### Tickets
- `GET /api/tickets` — List tickets (requires auth).
- `POST /api/tickets` — Create a new ticket.

### Events
- `GET /api/events` — List events.
- `POST /api/events` — Create a new event.

### Users
- `GET /api/users` — List users (admin only).
- `POST /api/users` — Invite new user.

### Settings
- `GET /api/settings/school-info` — Get school info.
- `POST /api/settings/school-info` — Update school info.

---

## Response Format
All endpoints return:
- Success: `{ ok: true, data: ... }`
- Error: `{ ok: false, error: { code, message, details } }`

---

## Authentication
Include JWT in `Authorization` header for protected routes.

---

## More
For detailed schema, see `types/api.ts`.
