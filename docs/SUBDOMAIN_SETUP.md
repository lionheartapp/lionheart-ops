# Step-by-step: Subdomain setup (e.g. linfieldchristianschool.lionheartapp.com)

This guide covers (1) DNS so school subdomains reach your app, and (2) setting the organization slug in the database so the app knows which org to load for that subdomain.

---

## Part 1: DNS — point subdomains to your app

Where you do this depends on **where your domain is registered** (e.g. GoDaddy, Namecheap, Cloudflare, Google Domains) and **where the app is hosted** (e.g. Vercel). The goal: when someone visits `linfieldchristianschool.lionheartapp.com`, the request goes to the same server that serves `lionheartapp.com`.

### If you use **Vercel** and the project is already deployed

1. **Get the Vercel target for your domain**
   - In [Vercel Dashboard](https://vercel.com/dashboard) → your project → **Settings** → **Domains**.
   - Add the **apex** domain first if you haven’t: `lionheartapp.com`.
   - Note the value Vercel shows for the root domain (e.g. a CNAME target like `cname.vercel-dns.com` or an A record).

2. **Add the wildcard subdomain in Vercel**
   - In the same **Domains** section, click **Add**.
   - Enter: `*.lionheartapp.com` (the asterisk is the wildcard).
   - Save. Vercel will show the DNS record you need (usually a CNAME from `*` or `*.lionheartapp.com` to a Vercel host).

3. **Create the DNS record at your domain registrar**
   - Log in where **lionheartapp.com** is registered (e.g. Cloudflare, GoDaddy, Namecheap).
   - Open **DNS** / **DNS Management** for `lionheartapp.com`.
   - Add a record:
     - **Type:** `CNAME` (or whatever Vercel’s Domains page says).
     - **Name / Host:**  
       - Some providers: `*` (covers all subdomains).  
       - Others: `*.lionheartapp.com` or “all subdomains” / “wildcard.”
     - **Value / Target / Points to:** the value Vercel shows (e.g. `cname.vercel-dns.com`).
   - **TTL:** default (e.g. 3600) is fine.
   - Save.

4. **Optional: add a specific subdomain instead of wildcard**
   - If your provider doesn’t support a wildcard, add one record per school:
     - **Name:** `linfieldchristianschool` (no `.lionheartapp.com` in the name).
     - **Type:** `CNAME`.
     - **Value:** same as in step 3 (e.g. `cname.vercel-dns.com`).
   - Repeat for each school subdomain you need.

5. **Wait and verify**
   - DNS can take a few minutes up to 48 hours (often 5–15 minutes).
   - Visit `https://linfieldchristianschool.lionheartapp.com` (or your wildcard). You should hit your app; if SSL isn’t ready yet, wait a bit—Vercel will provision the cert.

### If you use **another host** (not Vercel)

1. **Get the host’s target for your domain**
   - From your hosting provider, get the CNAME target or A record for your app (e.g. `yourapp.azurewebsites.net` or a load balancer).

2. **At your domain registrar (where lionheartapp.com is managed)**
   - Open **DNS** for `lionheartapp.com`.
   - Add:
     - **Type:** `CNAME`.
     - **Name:** `*` (or `*.lionheartapp.com` / “wildcard,” depending on the registrar).
     - **Value:** the host’s target from step 1.
   - Save.

3. **Ensure the host accepts the domain**
   - In the host’s dashboard, add the domain `lionheartapp.com` and, if required, `*.lionheartapp.com` (or list each subdomain) so it serves and issues SSL for those hostnames.

---

## Part 2: Database — set the organization slug

The app looks up the organization by **slug** that matches the subdomain. For `linfieldchristianschool.lionheartapp.com`, the slug must be **linfieldchristianschool**.

### Option A: Prisma Studio (GUI)

1. **Open Prisma Studio**
   - From the repo root:
     ```bash
     cd platform && npx prisma studio
     ```
   - A browser tab opens (usually http://localhost:5555).

2. **Open the Organization table**
   - Click **Organization** in the left sidebar.

3. **Find Linfield and set the slug**
   - Find the row for Linfield Christian School (use **name** or search).
   - Click the **slug** cell and set it to: **linfieldchristianschool** (no spaces, lowercase; this must match the subdomain).
   - Save (check for a save icon or click another row).

4. **If Linfield doesn’t exist yet**
   - Click **Add record** and fill at least:
     - **name:** e.g. `Linfield Christian School`
     - **slug:** `linfieldchristianschool`
     - Any other required fields your schema has.
   - Save.

### Option B: SQL (direct)

1. **Connect to your database**
   - Use any Postgres client (psql, TablePlus, Supabase SQL editor, etc.) with the same connection string as in `platform/.env` (`DATABASE_URL`).

2. **See current organizations**
   ```sql
   SELECT id, name, slug FROM "Organization";
   ```

3. **Update Linfield’s slug**
   ```sql
   UPDATE "Organization"
   SET slug = 'linfieldchristianschool'
   WHERE name ILIKE '%Linfield%';
   ```
   - If you have multiple orgs with “Linfield” in the name, use the primary key instead:
   ```sql
   UPDATE "Organization"
   SET slug = 'linfieldchristianschool'
   WHERE id = 'YOUR_ORG_ID_HERE';
   ```

4. **Or insert a new org** (if needed)
   - Easiest: use **Prisma Studio** (Option A) and click “Add record,” or run your **seed** (Option C) after adding Linfield with slug `linfieldchristianschool`.
   - If you use raw SQL, your schema uses CUID for `id`; generate a CUID (e.g. from an online generator or a small script) and insert with all required columns from your schema.

### Option C: Seed or script (if you use one)

If you already have a seed file or script that creates/updates organizations:

- Ensure it sets **slug** to **linfieldchristianschool** for Linfield (and that the name matches how you identify Linfield in the script).
- Run the seed/script (e.g. `npm run db:seed` or your custom script) after changing it.

---

## Quick checklist

- [ ] DNS: Wildcard `*.lionheartapp.com` (or `linfieldchristianschool.lionheartapp.com`) points to your app host (e.g. Vercel).
- [ ] DNS: App host is configured to accept that domain/subdomain and serve SSL.
- [ ] Database: Organization for Linfield has **slug** = **linfieldchristianschool**.
- [ ] Test: Open `https://linfieldchristianschool.lionheartapp.com` → should redirect to `/app` and load the dashboard for that org.

If the subdomain doesn’t resolve, re-check DNS (dig/host/nslookup). If the app loads but shows “School not found” or wrong org, re-check the **slug** in the **Organization** table.
