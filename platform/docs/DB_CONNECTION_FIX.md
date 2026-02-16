# Database Connection Fix (TLS "bad certificate format")

If you see `P1011: Error opening a TLS connection: bad certificate format` when running `npx prisma db push` or migrations:

## Fix: Remove `trustServerCertificate` from connection strings

The `trustServerCertificate=true` parameter is **not** a standard PostgreSQL option—it can confuse the Node.js TLS stack. Remove it from both `DATABASE_URL` and `DIRECT_URL` in `.env`:

**Before:**
```
DATABASE_URL="postgresql://...?pgbouncer=true&sslmode=require&trustServerCertificate=true"
DIRECT_URL="postgresql://...?sslmode=require&trustServerCertificate=true"
```

**After:**
```
DATABASE_URL="postgresql://...?pgbouncer=true&sslmode=require"
DIRECT_URL="postgresql://...?sslmode=require"
```

Then run:
```bash
npx prisma migrate deploy
```
or
```bash
npx prisma db push
```

## Applying the Water Management migration manually

If Prisma still can't connect, you can run the migration directly in the **Supabase SQL Editor**:

1. Open your Supabase project → SQL Editor
2. Copy the contents of `prisma/migrations/20250212000002_water_management/migration.sql`
3. Paste and run

After the migration succeeds, run `npx prisma generate` to refresh the client.
