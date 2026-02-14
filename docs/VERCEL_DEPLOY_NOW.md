# Deploy to Vercel — Step-by-Step

Both builds pass locally. Follow these steps in order.

---

## Step 1: Push Your Code to GitHub

You've had auth issues with `git push`. Use one of these:

### Option A: GitHub CLI (recommended)
```bash
brew install gh
gh auth login
# Choose: GitHub.com, HTTPS, Login with a web browser

cd "/Users/mkerley/Desktop/Linfield Test"
git add .
git status
git commit -m "Generic branding, build fixes, sample directory"
git push origin main
```

### Option B: Token in URL
```bash
cd "/Users/mkerley/Desktop/Linfield Test"
git add .
git commit -m "Generic branding, build fixes, sample directory"
git push https://YOUR_USERNAME:YOUR_TOKEN@github.com/lionheartapp/lionheart-ops.git main
```

---

## Step 2: Deploy Platform First

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import **lionheartapp/lionheart-ops**
3. **Root Directory:** Click Edit → set to `platform`
4. Framework will auto-detect as Next.js
5. **Environment Variables** (add before deploying):

   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | Your Supabase pooled URL (from platform/.env) |
   | `DIRECT_URL` | Your Supabase direct URL |
   | `JWT_SECRET` | Run `openssl rand -base64 32` — use output |
   | `NEXT_PUBLIC_DEFAULT_ORG_ID` | `9a8bfad3-abad-483e-a393-1f3e7f9be1d7` |
   | `OPENAI_API_KEY` | Your OpenAI key |
   | `NEXT_PUBLIC_PLATFORM_URL` | Leave blank for now — add after deploy |
   | `NEXT_PUBLIC_LIONHEART_URL` | Leave blank for now — add after deploy |

6. **Deploy**
7. Wait for build → copy the URL (e.g. `lionheart-ops-xxx.vercel.app`)

---

## Step 3: Deploy Lionheart

1. [vercel.com/new](https://vercel.com/new) again
2. Import **same repo** (lionheartapp/lionheart-ops)
3. **Root Directory:** `.` (root)
4. Framework: Vite (auto)
5. **Environment Variables**:

   | Name | Value |
   |------|-------|
   | `VITE_PLATFORM_URL` | **Your Platform URL from Step 2** (e.g. https://lionheart-ops-xxx.vercel.app) |
   | `VITE_CURRENT_ORG_ID` | `9a8bfad3-abad-483e-a393-1f3e7f9be1d7` |
   | `VITE_ORG_NAME` | `your school` |
   | `VITE_GEMINI_API_KEY` | Your Gemini key |

6. **Deploy**
7. Copy the Lionheart URL

---

## Step 4: Wire Everything Up

1. **Platform** project → Settings → Environment Variables
2. Add/update:
   - `NEXT_PUBLIC_PLATFORM_URL` = your Platform URL
   - `NEXT_PUBLIC_LIONHEART_URL` = your Lionheart URL
3. **Redeploy** Platform (Deployments → ⋮ → Redeploy)

---

## Step 5: Test

- **Lionheart:** Open your Lionheart URL → should load dashboard
- **Platform:** Open Platform URL `/login` → sign in with email/password
- **Google OAuth:** Add `https://YOUR-PLATFORM-URL/api/auth/google/callback` in Google Cloud Console if you want Google sign-in

---

## If Platform Build Fails on Vercel

- **Redeploy** with "Clear cache and redeploy"
- Check build logs for the exact error
- The expenses `ocrData` fix and Suspense wrappers should be in your pushed code
