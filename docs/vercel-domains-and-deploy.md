# Vercel: Domains & Deployment

## Live Domains

| Domain | Purpose | Status |
|--------|---------|--------|
| `coupon-cycle.site` | Main app — credit card benefits | ✅ Live |
| `www.coupon-cycle.site` | Alias for main app | ✅ Live |
| `loyalty.coupon-cycle.site` | Loyalty program landing page | ✅ Live |

All domains point to the same Vercel deployment. The `loyalty` subdomain is detected by Next.js middleware (`src/middleware.ts`) which rewrites `/` → `/loyalty-landing`.

## Adding a New Subdomain

1. **Vercel CLI** (preferred):
   ```bash
   # Temporarily switch to coupon-cycle project
   cp .vercel/project.json .vercel/project.json.bak
   echo '{"projectId":"prj_x0VAgiuO3PAem4IUmeVo9dsRMCsx","orgId":"team_IVhBm6B2M4mIXzermYdxeqRK","projectName":"coupon-cycle"}' > .vercel/project.json
   vercel domains add <subdomain>.coupon-cycle.site
   cp .vercel/project.json.bak .vercel/project.json && rm .vercel/project.json.bak
   ```

2. **Vercel Dashboard**: Project → Settings → Domains → Add.

3. **DNS**: Add a CNAME record at your registrar:
   - **Type**: CNAME
   - **Name**: `<subdomain>`
   - **Value**: `cname.vercel-dns.com`

4. **Middleware**: Update `src/middleware.ts` to handle the new subdomain.

---

## Build Command

```bash
prisma generate && (prisma migrate deploy || echo 'Migration deploy skipped — check DIRECT_URL') && next build
```

- `prisma generate` — regenerates the Prisma client
- `prisma migrate deploy` — applies pending migrations using `DIRECT_URL` (non-pooler endpoint)
- Falls back gracefully if the DB is unreachable (e.g. Neon cold start)
- `next build` — builds the Next.js application

## Required Vercel Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon **pooler** endpoint (has `-pooler` in hostname) |
| `DIRECT_URL` | Neon **direct** endpoint (no `-pooler`) — required for `prisma migrate deploy` |
| `DATABASE_URL_DEV` | Development database branch |
| `NEXTAUTH_URL` | Production URL (`https://coupon-cycle.site`) |
| `NEXTAUTH_SECRET` | NextAuth secret key |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret |
| `FACEBOOK_CLIENT_ID` | Facebook OAuth client ID |
| `FACEBOOK_CLIENT_SECRET` | Facebook OAuth client secret |
| `RESEND_API_KEY` | Resend email service API key |
| `FROM_EMAIL` | Sender email address |
| `CRON_SECRET` | Secret for cron job authorization |
| `SERPAPI_API_KEY` | SerpApi key for card image downloads |
| `GOOGLE_ANALYTICS_ID` | Google Analytics measurement ID |

### Why DIRECT_URL?

Neon provides two connection endpoints:
- **Pooler** (`-pooler`): Connection pooling for app queries — handles many concurrent connections efficiently
- **Direct** (no `-pooler`): Direct PostgreSQL connection — required by `prisma migrate deploy` because it uses advisory locks (`SELECT pg_advisory_lock(...)`) which don't work through poolers

The Prisma schema uses both:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")      // pooler — used by app queries
  directUrl = env("DIRECT_URL")        // direct — used by migrations
}
```

### Managing Env Vars via CLI

```bash
# List all env vars
vercel env ls

# Add a new env var (pipe value via stdin)
echo "value" | vercel env add VAR_NAME production
echo "value" | vercel env add VAR_NAME preview
echo "value" | vercel env add VAR_NAME development

# Pull env vars locally
vercel env pull .env.vercel
```

---

## If a Deployment Failed

### Where to look

1. **Vercel MCP** (from Cursor): Use `get_deployment_build_logs` tool
2. **Vercel Dashboard** → Project → Deployments → open the failed deployment
3. Check **Build logs** for the specific error

### Common causes

| Cause | What you see | Fix |
|-------|-------------|-----|
| **DB timeout (advisory lock)** | `P1002: Timed out trying to acquire a postgres advisory lock` | Ensure `DIRECT_URL` env var is set to the non-pooler endpoint. The build command falls back gracefully, so this may not block the build. |
| **Missing DIRECT_URL** | `Environment variable not found: DIRECT_URL` during `prisma migrate deploy` | Add `DIRECT_URL` to Vercel env vars (direct Neon endpoint, no `-pooler`). Migration will be skipped but build continues. |
| **Wrong workspace root** | "multiple lockfiles" warning | Fixed with `outputFileTracingRoot` in `next.config.ts`. |
| **Missing env vars** | Build or runtime fails on missing variables | Add all variables from the table above in Vercel Settings → Environment Variables. |
| **Prisma client issues** | Errors about `@prisma/client` or generated client | Build command already runs `prisma generate` first. |
| **Node version** | Incompatible Node or lockfile issues | Set Node.js Version to 20.x in Vercel Settings → General. |

### Re-run a failed deployment

- **Dashboard**: Open the failed deployment → click **Redeploy**
- **CLI**: `vercel --prod` (deploys from local, not recommended for routine deploys)
- **Git**: Push a new commit or empty commit: `git commit --allow-empty -m "chore: trigger redeploy" && git push`

---

## Vercel Project IDs (Reference)

| Project | ID | Notes |
|---------|-----|-------|
| `coupon-cycle` | `prj_x0VAgiuO3PAem4IUmeVo9dsRMCsx` | Production deployments from GitHub |
| `credit-card-tracker` | `prj_ng6vVQVQXr5XWUQmbYcPk6JOTRRc` | CLI-linked project (local `.vercel/project.json`) |
| Team | `team_IVhBm6B2M4mIXzermYdxeqRK` | "Lifan Chen's projects" |
