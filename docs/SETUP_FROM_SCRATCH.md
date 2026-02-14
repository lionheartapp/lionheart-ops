# Setup from Scratch: GitHub → Vercel

Clean walkthrough to get your code on GitHub and deployed.

---

## Part 1: GitHub

### Option A — Use Existing Repo (lionheartapp/lionheart-ops)

Your remote is already set. You need working credentials.

**1. Create a token** (use **classic** tokens for simpler setup):

1. Go to [github.com/settings/tokens/new](https://github.com/settings/tokens/new)
2. Note: Use **"Generate new token (classic)"** — fine-grained can be tricky.
3. Name: `lionheart-push`
4. Expiration: 90 days
5. Check: **repo** (full control)
6. Generate → copy the token (`ghp_xxxx...`)

**2. Clear old credentials** (macOS):

```bash
git credential-osxkeychain erase
```

Type this, press Enter, then type:

```
host=github.com
protocol=https
```

Press Enter, then Enter again (blank line) to finish.

**3. Push with token:**

```bash
cd "/Users/mkerley/Desktop/Linfield Test"
git push -u origin main
```

When prompted:
- **Username:** your GitHub username
- **Password:** paste the token (not your GitHub password)

---

### Option B — New Repo Under Your Personal Account

Use this if you prefer your own account or keep hitting auth issues.

**1. Create repo on GitHub:**

1. [github.com/new](https://github.com/new)
2. Name: `lionheart-ops`
3. Private
4. **Do NOT** add README, .gitignore, or license
5. Create repository

**2. Point your local project at it:**

```bash
cd "/Users/mkerley/Desktop/Linfield Test"
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/lionheart-ops.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username. Use a classic token as password if prompted.

---

## Part 2: Vercel

After `git push` succeeds:

### Deploy Platform (Next.js)

1. [vercel.com/new](https://vercel.com/new)
2. Import from GitHub → select `lionheart-ops`
3. **Root Directory:** click Edit → set to `platform`
4. **Framework:** Next.js (auto)
5. Add **Environment Variables** (Production):
   - `DATABASE_URL` — Supabase pooled URL
   - `DIRECT_URL` — Supabase direct URL  
   - `JWT_SECRET` — `openssl rand -base64 32`
   - `NEXT_PUBLIC_DEFAULT_ORG_ID` — `9a8bfad3-abad-483e-a393-1f3e7f9be1d7`
   - `GOOGLE_CLIENT_ID` — from Google Cloud
   - `GOOGLE_CLIENT_SECRET` — from Google Cloud
   - `OPENAI_API_KEY` — your key
6. Deploy → copy the URL (e.g. `lionheart-ops-platform.vercel.app`)

### Deploy Lionheart (Vite)

1. [vercel.com/new](https://vercel.com/new)
2. Import same repo again
3. **Root Directory:** `.` (leave default)
4. **Framework:** Vite (auto)
5. Add **Environment Variables**:
   - `VITE_PLATFORM_URL` — Platform URL from step above
   - `VITE_CURRENT_ORG_ID` — `9a8bfad3-abad-483e-a393-1f3e7f9be1d7`
   - `VITE_ORG_NAME` — `your school`
   - `VITE_GEMINI_API_KEY` — your key
6. Deploy → copy the URL

### Wire URLs & OAuth

1. **Platform** env vars:
   - `NEXT_PUBLIC_PLATFORM_URL` = Platform URL
   - `NEXT_PUBLIC_LIONHEART_URL` = Lionheart URL
2. Redeploy Platform
3. **Google OAuth:** add `https://YOUR-PLATFORM-URL/api/auth/google/callback` in Google Cloud Console

---

## Quick Command Reference

```bash
# Check status
git status
git remote -v

# Clear credentials (macOS)
git credential-osxkeychain erase
# Then type: host=github.com
#           protocol=https
#           (blank line, Enter)

# Push
git push -u origin main
```
