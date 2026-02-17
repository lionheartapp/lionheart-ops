# Fixing the database connection (Cursor / local)

If `npx prisma db push` or other Prisma commands fail with **P1011: Error opening a TLS connection: bad certificate format**, the connection from your machine to Supabase is failing on SSL/TLS. Use the steps below in Cursor.

## 1. Open your env file

In Cursor:

- Open the **platform** folder.
- Open **`.env`** (if you don’t see it, use **File → Open** and choose `.env`, or enable “Show hidden files” in the file tree).

If you don’t have a `.env` yet, duplicate `.env.example` and rename the copy to `.env`.

## 2. Get the right connection strings from Supabase

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Click **Connect** (or **Project Settings → Database**).
3. Under **Connection string**, choose **Session mode** (port **5432**).
4. Copy the **URI** and replace `[YOUR-PASSWORD]` with your database password.

It will look like:

```text
postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
```

Example region: `us-west-2`.

## 3. Set both DATABASE_URL and DIRECT_URL

Prisma needs **both** variables. Use the **same** Session-mode URL (port 5432) for each, and add `?sslmode=require` so TLS is used without strict cert verification that can trigger “bad certificate format” on macOS:

```env
DATABASE_URL="postgresql://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require"
DIRECT_URL="postgresql://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require"
```

Replace:

- `YOUR_PROJECT_REF` with your project reference (e.g. from the Supabase URL).
- `YOUR_PASSWORD` with your database password.
- `us-west-2` with your pooler region if different.

**Important:** If your password contains special characters (e.g. `#`, `@`, `%`), URL-encode them in the connection string (e.g. `%40` for `@`).

## 4. If it still fails: try no-verify (dev only)

For **local development only**, you can relax SSL verification:

```env
DATABASE_URL="postgresql://...pooler.supabase.com:5432/postgres?sslmode=no-verify"
DIRECT_URL="postgresql://...pooler.supabase.com:5432/postgres?sslmode=no-verify"
```

Do **not** use `no-verify` in production.

## 5. Run Prisma again

In a terminal (with **platform** as the current directory):

```bash
cd platform
npx prisma db push
```

Or run the same command from Cursor’s integrated terminal (ensure the workspace root or `platform` is the cwd).

## Summary

| Issue | Fix |
|-------|-----|
| P1011 / bad certificate format | Use **Session mode** (port **5432**) for both URLs and add `?sslmode=require` (or `?sslmode=no-verify` for local only). |
| Prisma says DIRECT_URL not set | Add `DIRECT_URL` in `.env` with the same Session-mode URL as above. |
| Connection refused / timeout | Check region, project ref, password, and that the project isn’t paused. |

For more options (e.g. transaction mode for the app), see `platform/.env.example`.
