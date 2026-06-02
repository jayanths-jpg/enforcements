# Fed Enforcement Monitor

Automated daily monitoring of Federal Reserve enforcement actions.
Fetches pages from federalreserve.gov, extracts data with GPT-4o-mini, stores in Supabase, and displays in a React dashboard.

## Architecture

```
Browser → Netlify (React frontend)
               ↓
         Render (Node/Express API)
          ↙              ↘
federalreserve.gov    OpenAI GPT-4o-mini
               ↓
          Supabase (PostgreSQL)
               ↑
        cron-job.org (daily 9am trigger)
```

## Project structure

```
fed-enforcement/
├── backend/          ← Deploy to Render
│   ├── src/
│   │   ├── index.js
│   │   ├── lib/
│   │   │   ├── supabase.js
│   │   │   └── scraper.js
│   │   └── routes/
│   │       ├── enforcements.js
│   │       └── scrape.js
│   ├── package.json
│   └── .env.example
├── frontend/         ← Deploy to Netlify
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Enforcements.jsx
│   │   │   └── Scraper.jsx
│   │   ├── lib/api.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── .env.example
└── supabase_schema.sql
```

---

## Step 1 — Supabase

1. Go to https://supabase.com and create a free project
2. Once created, open the **SQL Editor**
3. Paste the contents of `supabase_schema.sql` and click **Run**
4. Go to **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role secret** → `SUPABASE_SERVICE_KEY` (not the anon key)

---

## Step 2 — Render (backend)

1. Push the `backend/` folder to a GitHub repo (or the whole monorepo)
2. Go to https://render.com → **New Web Service**
3. Connect your GitHub repo
4. Set the **Root Directory** to `backend`
5. Set **Build Command**: `npm install`
6. Set **Start Command**: `npm start`
7. Add these **Environment Variables**:

| Key | Value |
|-----|-------|
| `OPENAI_API_KEY` | `sk-...` your OpenAI key |
| `SUPABASE_URL` | from Step 1 |
| `SUPABASE_SERVICE_KEY` | from Step 1 |
| `CRON_SECRET` | any random string e.g. `openssl rand -hex 20` |
| `FRONTEND_URL` | your Netlify URL (add after Step 3, or use `*` temporarily) |

8. Deploy. Note your Render URL: `https://your-app.onrender.com`

---

## Step 3 — Netlify (frontend)

1. Push the `frontend/` folder to GitHub
2. Go to https://netlify.com → **Add new site → Import from Git**
3. Set **Base directory**: `frontend`
4. Set **Build command**: `npm run build`
5. Set **Publish directory**: `frontend/dist`
6. Add **Environment variable**:
   - `VITE_API_URL` = `https://your-app.onrender.com/api`
7. Deploy

Go back to Render and update `FRONTEND_URL` to your Netlify URL.

---

## Step 4 — Daily cron (cron-job.org)

1. Go to https://cron-job.org and create a free account
2. Create a new cronjob:
   - **URL**: `https://your-app.onrender.com/api/scrape/today`
   - **Method**: POST
   - **Headers**: `x-cron-secret: YOUR_CRON_SECRET`
   - **Schedule**: `0 9 * * 1-5` (weekdays at 9am)
3. Save and enable

---

## Step 5 — Backfill historical data

In your deployed frontend, go to **Run scraper** and use the date range picker to backfill historical dates. The scraper processes up to 60 days at a time and shows a live log.

---

## Local development

```bash
# Backend
cd backend
cp .env.example .env   # fill in your keys
npm install
npm run dev            # runs on localhost:3001

# Frontend (new terminal)
cd frontend
cp .env.example .env   # set VITE_API_URL=http://localhost:3001/api
npm install
npm run dev            # runs on localhost:5173
```

---

## API endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/enforcements` | Query enforcement records (filters: from, to, state, search) |
| GET | `/api/enforcements/checks` | Daily check summary log |
| GET | `/api/enforcements/stats` | Summary metrics |
| POST | `/api/scrape/single` | Scrape one date `{ date: "YYYY-MM-DD" }` |
| POST | `/api/scrape/range` | Scrape date range (SSE stream) `{ from, to }` |
| POST | `/api/scrape/today` | Cron endpoint (requires `x-cron-secret` header) |
