# School Facility Management Platform

Next.js + Prisma + Supabase foundation for school facility management.

## Setup

1. **Install dependencies**
   ```bash
   cd platform && npm install
   ```

2. **Create Supabase project**
   - Go to [supabase.com](https://supabase.com) and create a project
   - In Project Settings → Database, copy the connection string

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your DATABASE_URL and Supabase keys
   ```

4. **Generate Prisma client & push schema**
   ```bash
   npx prisma generate
   npm run db:push
   ```

5. **Run dev server**
   ```bash
   npm run dev
   ```

## Database Schema

| Table | Purpose |
|-------|---------|
| **User** | Roles: Teacher, Maintenance, Admin, Site Secretary |
| **Building** | School buildings |
| **Room** | Rooms with Matterport_URL and Coordinates |
| **TeacherSchedule** | DayOfWeek, StartTime, EndTime, RoomID, Subject |
| **Ticket** | Category (Maintenance/IT/Event), Status, Priority, ManHours, SafetyProtocolChecklist (JSON) |
| **InventoryItem** | Shared resources (Tables, Chairs, etc.) |
| **InventoryStock** | Stock by location |
