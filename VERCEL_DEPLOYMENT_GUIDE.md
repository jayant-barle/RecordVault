# Vercel Deployment Guide — RecordVault

This repository is pre-configured for full-stack deployment on [Vercel](https://vercel.com). Both the React + Vite frontend and the Express REST API deploy as a single unified Vercel project.

---

## Architecture on Vercel

- **Frontend:** Built via Vite (`npm run vercel-build`) into `client/dist`, served with edge-caching across Vercel's global CDN.
- **Backend API:** Express server mounted as a serverless function via [`api/index.js`](file:///e:/Code%20Tresure/Excel%20project/api/index.js).
- **Routing:** Configured in [`vercel.json`](file:///e:/Code%20Tresure/Excel%20project/vercel.json) — all `/api/*` requests route to the serverless function, and all other routes serve the SPA `index.html`.
- **Database:** Connects via `DATABASE_URL` to any cloud PostgreSQL database (Neon, Supabase, Vercel Postgres, AWS RDS). SSL is automatically enabled in production.

---

## Method 1: Deploy via Vercel Dashboard (Recommended & Easiest)

Because this repository is already pushed to GitHub (`https://github.com/jayant-barle/RecordVault.git`), you can deploy in 2 minutes:

1. Go to **[vercel.com/new](https://vercel.com/new)** and sign in.
2. Under **Import Git Repository**, select **`RecordVault`** (or paste `https://github.com/jayant-barle/RecordVault`).
3. In the project configuration:
   - **Framework Preset:** Select **Other** (or Vite).
   - **Root Directory:** Leave as `./` (Root).
   - **Build Command:** Leave as default (it reads `npm run vercel-build` from `vercel.json`).
   - **Output Directory:** Leave as default (it reads `client/dist` from `vercel.json`).
4. **Environment Variables**:
   Add the following variables:
   | Variable | Value | Description |
   |---|---|---|
   | `DATABASE_URL` | `postgres://user:password@host:5432/dbname?sslmode=require` | Your cloud PostgreSQL connection string (from Neon, Supabase, or Vercel Postgres) |
   | `JWT_SECRET` | `your_long_secure_random_secret_string` | Secret key used for signing JWT auth tokens |
   | `NODE_ENV` | `production` | Production mode |
5. Click **Deploy**.
6. When the build finishes, your site is live with a secure `https://your-project.vercel.app` URL!

---

## Method 2: Deploy via Vercel CLI

If you prefer deploying from your terminal:

1. Log into your Vercel account:
   ```powershell
   npx vercel login
   ```
2. Link and deploy your project:
   ```powershell
   npx vercel
   ```
   Follow the prompts (Accept the defaults by pressing `Enter`).
3. Deploy to production:
   ```powershell
   npx vercel --prod
   ```
4. Set environment variables via CLI:
   ```powershell
   npx vercel env add DATABASE_URL
   npx vercel env add JWT_SECRET
   ```

---

## Database Setup Options (Free Cloud PostgreSQL)

Serverless functions on Vercel are ephemeral. For production data persistence, connect a hosted PostgreSQL database:

### Option A: Neon Postgres (Recommended — Free Tier)
1. Sign up for free at [neon.tech](https://neon.tech).
2. Create a database project (takes 5 seconds).
3. Copy the pooled connection string (`postgres://...sslmode=require`).
4. Paste it as `DATABASE_URL` in Vercel.

### Option B: Supabase (Free Tier)
1. Sign up at [supabase.com](https://supabase.com) and create a project.
2. In Project Settings > Database > Connection String, copy the URI.
3. Paste it as `DATABASE_URL` in Vercel.

### Option C: Vercel Postgres (Integrated)
1. In your Vercel project dashboard, navigate to the **Storage** tab.
2. Click **Create Database** > **Postgres**.
3. Vercel will automatically inject `DATABASE_URL` and `POSTGRES_URL` into your environment variables.

---

## Database Migrations & Initial Admin Login

- Database migrations run **automatically on first startup/cold start** of the serverless function.
- Default seeded administrator credentials:
  - **Username:** `admin`
  - **Password:** `admin123`
  *(Or `manager` / `manager123`)*

---

## Local Verification Commands

To test the build locally before deploying:
```powershell
# Verify full-stack build
npm run vercel-build

# Run all test assertions
npm test
```
