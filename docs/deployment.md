# FlowForge Deployment

FlowForge is designed for a single Vercel deployment with a React/Vite frontend and a FastAPI serverless API under `/api`.

## 1. Push To GitHub

Create a GitHub repository and push this project.

```bash
git init
git add .
git commit -m "Initial FlowForge portfolio build"
git branch -M main
git remote add origin <your-repository-url>
git push -u origin main
```

## 2. Create A Turso Database

Create a Turso database using the Turso CLI or dashboard. Retrieve:

- Database URL, usually shaped like `libsql://...`
- Database auth token

## 3. Import Into Vercel

Import the GitHub repository into Vercel.

Recommended project settings:

- Framework preset: Other
- Build command: `cd frontend && npm ci && npm run build`
- Output directory: `frontend/dist`

The included `vercel.json` keeps `/api/*` routed to `api/index.py` and sends frontend routes to the SPA entry point.

## 4. Environment Variables

Set these in Vercel:

```text
ENVIRONMENT=production
DATABASE_URL=
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-token
JWT_SECRET_KEY=use-a-long-random-secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
FRONTEND_URL=https://your-project.vercel.app
CORS_ORIGINS=https://your-project.vercel.app
VITE_API_BASE_URL=/api
```

Do not expose `TURSO_AUTH_TOKEN` to frontend JavaScript. It belongs in backend/serverless environment variables only.

## 5. Seed Demo Data

For local development:

```bash
cd backend
python -m app.seed.seed_data
```

For production, run seeding from a trusted machine with production environment variables loaded. Do not expose reset or seed operations as public API endpoints.

Reset local demo data:

```bash
cd backend
python -m app.seed.reset_demo
```

## 6. Verify Deployment

Check:

- `https://your-project.vercel.app/api/health`
- `https://your-project.vercel.app/login`
- Login with `admin@flowforge.local` and `Demo123!`
- Start a Purchase Request as `employee@flowforge.local`
- Approve and complete it as `manager@flowforge.local`
