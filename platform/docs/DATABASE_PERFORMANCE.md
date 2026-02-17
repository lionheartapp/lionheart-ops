# Database performance (Supabase / Prisma)

If the Supabase **Query Performance** or **Slow Queries** dashboard shows high load, use this as a checklist.

## What shows up most

| Query | Cause | What you can do |
|-------|--------|------------------|
| **`SELECT name FROM pg_timezone_names`** (often ~40%+ time, role: authenticator) | Run by Supabase’s auth layer on new connections. High volume = lots of new connections. | Reduce connection churn (see below). You can’t change this query yourself. |
| **`pgbouncer.get_auth($1)`** (very high **Calls**) | Runs once per new connection to the pooler. | Lower how many connections your app opens (limit Prisma pool size). |
| Extension / catalog queries (role: postgres) | Prisma/schema introspection or connection init. | Normal; keep connection count low so they run less often. |

## 1. Limit Prisma’s connection pool

Fewer connections = fewer auth calls and less `pg_timezone_names` load.

In **`platform/.env`**, add `connection_limit` to **`DATABASE_URL`** only (leave **`DIRECT_URL`** without it for migrations):

```env
# Example: cap at 5 connections per app instance
DATABASE_URL="postgresql://postgres.xxx:password@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=disable&connection_limit=5"
DIRECT_URL="postgresql://postgres.xxx:password@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=disable"
```

- Use a small number (e.g. **3–10**) so total connections stay under your Supabase pool size.
- If you run multiple app instances (e.g. several Next.js servers), divide: e.g. pool_size 15 ÷ 3 instances → `connection_limit=5` per instance.

Optional: add `pool_timeout=20` (seconds to wait for a connection):

```env
...?sslmode=disable&connection_limit=5&pool_timeout=20
```

## 2. Keep a single Prisma client (already done)

The app uses a **singleton** Prisma client in `src/lib/prisma.ts` (reused via `globalThis` in dev). That avoids creating a new client (and new connections) per request. Don’t create `new PrismaClient()` in API routes or serverless handlers.

## 3. Supabase-side

- **Pool size**: In Supabase **Database → Settings**, ensure **Pool size** isn’t too small for your traffic.
- **Cache hit rate**: Aim for high cache hit rate on your main tables; the dashboard’s “Cache hit rate” per query helps spot bad ones.
- **`pg_timezone_names`**: If it still dominates after limiting connections, it’s an infrastructure/auth path; you can ask Supabase support if they have optimizations or a different pooler configuration.

## Quick fix to try now

1. Edit **`platform/.env`**.
2. In **`DATABASE_URL`** only, append **`&connection_limit=5`** (or `6`–`10` if you have headroom).
3. Restart the Next.js app and recheck the dashboard after some traffic.
