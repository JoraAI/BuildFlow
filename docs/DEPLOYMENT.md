# BuildFlow — Deployment Guide (Free Testing)

This guide covers hosting BuildFlow for **free-tier testing**: web UI on **Vercel**, API on a small Node host, plus managed Postgres and Redis.

---

## Architecture

```
Browser  →  Vercel (Expo web static export)
              ↓  EXPO_PUBLIC_API_URL
           Render / Railway / Fly  (Express API + background jobs)
              ↓                    ↓
           Neon / Supabase      Upstash Redis
           (PostgreSQL)
              ↓ optional
           Cloudflare R2 / AWS S3 (file uploads)
```

**Vercel alone is not enough.** The backend is a long-running Express server (cron jobs, Redis queues). Host it separately.

| Component | Recommended free host |
|-----------|----------------------|
| Web app (`apps/mobile`) | **Vercel** |
| API (`apps/backend`) | **Render** (free web service) |
| PostgreSQL | **Neon** or **Supabase** |
| Redis | **Upstash** |
| File storage (optional) | **Cloudflare R2** (S3-compatible) |

---

## 1. Prerequisites

- GitHub repo connected to Vercel and Render
- Node 20+ locally for one-time DB setup
- Generate secrets:

```bash
openssl rand -hex 32   # JWT_ACCESS_SECRET
openssl rand -hex 32   # JWT_REFRESH_SECRET
openssl rand -base64 32  # FILE_ENCRYPTION_MASTER_KEY
```

---

## 2. PostgreSQL (Neon)

1. Create a project at [neon.tech](https://neon.tech).
2. Copy the **pooled** connection string (SSL required):

```env
DATABASE_URL=postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/buildflow?sslmode=require
```

3. From your machine (once):

```bash
pnpm install
cd apps/backend
pnpm exec prisma migrate deploy
SEED_ALLOW_TRUNCATE=1 pnpm exec tsx prisma/seed.ts
```

This loads the **NH-45** demo project and all test users.

> **Warning:** `SEED_ALLOW_TRUNCATE=1` wipes all data. Use only on a fresh test database.

---

## 3. Redis (Upstash)

1. Create a database at [upstash.com](https://upstash.com).
2. Copy the **Redis URL** (often `rediss://…`):

```env
REDIS_URL=rediss://default:xxx@xxx.upstash.io:6379
```

Required for permissions cache, idempotency, and job queues.

---

## 4. Backend API (Render example)

### Service settings

| Field | Value |
|-------|--------|
| **Root directory** | repo root (or leave blank) |
| **Build command** | `pnpm install && pnpm --filter @buildflow/backend exec prisma generate && pnpm --filter @buildflow/backend build` |
| **Start command** | `node apps/backend/dist/server.js` |
| **Health check path** | `/health` |

### Environment variables (required)

```env
NODE_ENV=production
PORT=4000

DATABASE_URL=postgresql://...
REDIS_URL=rediss://...

JWT_ACCESS_SECRET=<64-char hex>
JWT_REFRESH_SECRET=<64-char hex>

CORS_ORIGIN=https://your-app.vercel.app
APP_PUBLIC_URL=https://your-app.vercel.app

FILE_ENCRYPTION_MASTER_KEY=<base64 32 bytes>
FILE_STORAGE_PROVIDER=s3

ALLOW_PUBLIC_COMPANY_REGISTRATION=true
TRIAL_DAYS=14
LOG_LEVEL=info
```

### File storage (pick one)

**Option A — Cloudflare R2 (recommended for free testing)**

```env
FILE_STORAGE_PROVIDER=s3
AWS_REGION=auto
AWS_S3_BUCKET=buildflow-test
AWS_ACCESS_KEY_ID=<r2 access key>
AWS_SECRET_ACCESS_KEY=<r2 secret>
# Set S3 endpoint in storage config if your code supports R2 endpoint env — otherwise use AWS S3.
```

**Option B — Google Drive**

```env
FILE_STORAGE_PROVIDER=drive
DRIVE_CLIENT_EMAIL=...
DRIVE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
DRIVE_ROOT_FOLDER_ID=...
```

Without cloud storage, **bill/tender uploads will not persist** on ephemeral hosts.

### Optional integrations

| Feature | Variables |
|---------|-----------|
| AI chatbot | `LLM_API_URL`, `LLM_API_KEY`, `LLM_MODEL` |
| SaaS checkout | `SAAS_RAZORPAY_*` or `SAAS_STRIPE_*` |
| Maps | `GOOGLE_MAPS_API_KEY` |

### Verify API

```bash
curl https://your-api.onrender.com/health
# → {"status":"ok",...}

curl -X POST https://your-api.onrender.com/api/platform/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@buildflow.com","password":"Admin@1234"}'
# → {"success":true,"data":{"accessToken":"...","admin":{...}}}
```

**Render free tier:** service sleeps after ~15 min idle; first request may take 30–60s.

---

## 5. Web app on Vercel

### Project settings

| Field | Value |
|-------|--------|
| **Root Directory** | `apps/mobile` |
| **Framework Preset** | Other |
| **Install Command** | `cd ../.. && pnpm install` |
| **Build Command** | `cd ../.. && pnpm --filter @buildflow/mobile exec expo export -p web` |
| **Output Directory** | `dist` |

### Environment variable

```env
EXPO_PUBLIC_API_URL=https://your-api.onrender.com/api
```

### SPA routing

Add `apps/mobile/vercel.json`:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Deploy. Open `https://your-app.vercel.app`.

---

## 6. Demo logins

After seeding:

### Tenant app (`/` → Login)

| Role | Email | Password |
|------|-------|----------|
| Owner | `owner@reddyconst.com` | `Test@1234` |
| PM | `pm@reddyconst.com` | `Test@1234` |
| Accountant | `accounts@reddyconst.com` | `Test@1234` |

All seeded users share password **`Test@1234`**.

### Platform admin (`/platform/login`)

| Email | Password |
|-------|----------|
| `admin@buildflow.com` | `Admin@1234` |

> **Important:** Platform admin is **not** the same as company login. Do **not** use `admin@buildflow.com` on the main `/login` screen — you will get *"Invalid email or password"*. Open **`/platform/login`** instead (or use the "Platform console" link on the sign-in page).

---

## 7. Troubleshooting

### Still see old projects (GVR, Trail, NH-65)

Your hosted database was not reseeded after the NH-45 migration. On the **hosted** DB:

```bash
DATABASE_URL="postgresql://..." SEED_ALLOW_TRUNCATE=1 pnpm exec tsx prisma/seed.ts
```

Then hard-refresh the browser (`Ctrl+Shift+R`).

### Platform admin login fails with “Missing authorization token”

Ensure backend includes the route-order fix: `/api/platform` must be registered **before** any catch-all `/api` router that applies `authenticateToken` (see `apps/backend/src/app.ts`). Redeploy the API after pulling latest `main`.

### `ERR_UNSUPPORTED_DIR_IMPORT` or `brace-expansion` / `expand` on startup

The API must compile `@buildflow/shared` to `dist/` (not load `src/*.ts` at runtime) and use **archiver v5** (CommonJS). Pull latest `main`, redeploy with build:

```bash
pnpm install && pnpm --filter @buildflow/backend exec prisma generate && pnpm --filter @buildflow/backend build
```

Optional: set `NODE_VERSION=20` in Render env for Node 20 LTS.

### CORS errors in browser

Set `CORS_ORIGIN` on the backend to your exact Vercel URL (no trailing slash). Multiple origins: comma-separated.

```env
CORS_ORIGIN=https://buildflow.vercel.app,https://buildflow-git-main-you.vercel.app
```

### API 502 / timeout on first load

Render free tier cold start. Wait or upgrade to a paid instance.

### Login works locally but not on Vercel

Check `EXPO_PUBLIC_API_URL` in Vercel **must** end with `/api`:

```env
EXPO_PUBLIC_API_URL=https://your-api.onrender.com/api
```

---

## 8. Cost summary (typical free testing)

| Service | Cost |
|---------|------|
| Vercel Hobby | $0 |
| Render free web service | $0 (cold starts) |
| Neon Postgres | $0 tier |
| Upstash Redis | $0 tier |
| Cloudflare R2 | $0 tier (optional) |

---

## 9. Production checklist (when you outgrow free tier)

- [ ] Custom domain + HTTPS on Vercel and API host
- [ ] `NODE_ENV=production`, strong JWT secrets, no default passwords
- [ ] Persistent file storage (S3/R2)
- [ ] Redis and Postgres on paid tiers for uptime
- [ ] Configure SaaS billing webhooks (`SAAS_RAZORPAY_WEBHOOK_SECRET`)
- [ ] Remove or rotate demo seed credentials
- [ ] Set up DB backups on Neon/Supabase

---

## 10. Local development (reference)

```bash
pnpm install
pnpm db:up                    # Postgres + Redis via Docker
cp .env.example .env          # edit JWT secrets
pnpm db:migrate
SEED_ALLOW_TRUNCATE=1 pnpm db:seed
pnpm dev
```

| Service | URL |
|---------|-----|
| API | http://localhost:4000 |
| Web | http://localhost:8081 or :19006 |
| Platform admin | http://localhost:8081/platform/login |

See also [TECHNICAL_OVERVIEW.md](./TECHNICAL_OVERVIEW.md) for architecture details.
