# Vercel Deployment Guide

Your project has two apps that deploy as **two separate Vercel projects**:

1. **Platform** (Next.js, port 3001) — backend API + admin UI (campus, login)
2. **Lionheart** (Vite/React) — main dashboard at root

---

## Step 1: Push to GitHub

If you haven’t already:

```bash
cd "/Users/mkerley/Desktop/Linfield Test"
git init
git add .
git commit -m "Initial commit"
# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

---

## Step 2: Deploy Platform (Next.js)

1. Go to [vercel.com](https://vercel.com) → **Add New** → **Project**
2. Import your GitHub repo
3. **Configure project**:
   - **Framework Preset:** Next.js
   - **Root Directory:** `platform` ← important
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `.next` (default)

4. **Environment Variables** (Settings → Environment Variables):

   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | Your Supabase pooled URL |
   | `DIRECT_URL` | Your Supabase direct URL |
   | `JWT_SECRET` | `openssl rand -base64 32` |
   | `NEXT_PUBLIC_DEFAULT_ORG_ID` | `9a8bfad3-abad-483e-a393-1f3e7f9be1d7` |
   | `NEXT_PUBLIC_PLATFORM_URL` | `https://your-platform.vercel.app` *(set after first deploy)* |
   | `NEXT_PUBLIC_LIONHEART_URL` | `https://your-lionheart.vercel.app` *(set after first deploy)* |
   | `GOOGLE_CLIENT_ID` | From Google Cloud Console |
   | `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
   | `OPENAI_API_KEY` | Your OpenAI key |

5. Deploy → note the URL (e.g. `lionheart-platform.vercel.app`)

6. **Google OAuth:** Add this redirect URI in [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
   ```
   https://YOUR-PLATFORM-URL.vercel.app/api/auth/google/callback
   ```

---

## Step 3: Deploy Lionheart (Vite)

1. **Add New** → **Project** (same repo)
2. **Configure project**:
   - **Framework Preset:** Vite
   - **Root Directory:** `.` (root, or leave empty)
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

3. **Environment Variables**:

   | Name | Value |
   |------|-------|
   | `VITE_PLATFORM_URL` | `https://your-platform.vercel.app` |
   | `VITE_CURRENT_ORG_ID` | `9a8bfad3-abad-483e-a393-1f3e7f9be1d7` |
   | `VITE_ORG_NAME` | `your school` |
   | `VITE_ORG_WEBSITE` | (optional) |
   | `VITE_GEMINI_API_KEY` | Your Gemini API key |

4. Deploy → note the URL (e.g. `lionheart.vercel.app`)

---

## Step 4: Wire URLs

After both deployments:

1. **Platform** → Settings → Environment Variables:
   - `NEXT_PUBLIC_PLATFORM_URL` = `https://YOUR-PLATFORM.vercel.app`
   - `NEXT_PUBLIC_LIONHEART_URL` = `https://YOUR-LIONHEART.vercel.app`

2. Redeploy Platform so the new env vars are used.

3. **Google OAuth**: Confirm the redirect URI includes your production Platform URL.

---

## Step 5: Custom Domains (Optional)

- Platform: e.g. `api.yourschool.com`
- Lionheart: e.g. `app.yourschool.com`

Add in Vercel: Project → Settings → Domains.

---

## Cron (Platform)

`platform/vercel.json` defines a monthly cron. Enable Vercel Cron Jobs in your plan (Pro) if you use it.

---

## Quick Reference

| App | Root Dir | Framework | URL after deploy |
|-----|----------|-----------|-------------------|
| Platform | `platform` | Next.js | `*.vercel.app` or custom |
| Lionheart | `.` (root) | Vite | `*.vercel.app` or custom |
