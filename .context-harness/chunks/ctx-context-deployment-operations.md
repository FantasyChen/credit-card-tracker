# 🚀 Deployment & Operations


### Vercel Configuration

**Automatic GitHub Deployment:**
- ✅ **AUTOMATIC**: Push to main branch → Automatic production deployment
- ✅ **NO MANUAL STEPS**: Vercel handles everything automatically
- ✅ **AGENT NOTE**: AI agents should NOT attempt manual deployment - simply push to GitHub
- Environment variables configured in Vercel dashboard
- Build command: `prisma generate && (prisma migrate deploy || echo 'skipped') && next build`
- Database migrations run automatically via `DIRECT_URL` (non-pooler endpoint); falls back gracefully on timeout
- `DIRECT_URL` env var must be set in Vercel (direct Neon endpoint, no `-pooler`)

**Cron Jobs** (configured in `vercel.json`):
- `/api/cron/check-benefits` — Daily at `0 5 * * *` (5:00 AM UTC). Uses bulk SQL `INSERT ... ON CONFLICT` to upsert all benefit statuses in 2-3 queries (~1.2s for 11K rows). Must complete within 10s (Hobby tier limit).
- `/api/cron/send-notifications` — Daily at `30 5 * * *` (5:30 AM UTC, 30 min after check-benefits). Uses 3 bulk queries + parallel email sends (~2s). Runs after check-benefits so statuses exist before notifications reference them.
- Both require the header `Authorization: Bearer <CRON_SECRET>`
- Both export `maxDuration = 10` (Vercel Hobby tier ceiling)
- **Hobby tier constraint**: 2 cron slots max, daily schedule only — both slots are used

Manual trigger examples:

```bash
# Replace <url> with http://localhost:3000 or the deployed URL
curl -i -X GET -H "Authorization: Bearer $CRON_SECRET" <url>/api/cron/check-benefits

# Notifications cron supports an optional mockDate (non-production only)
# ⚠️ NEVER trigger send-notifications against production locally — it sends real emails
curl -i -X GET -H "Authorization: Bearer $CRON_SECRET" "<url>/api/cron/send-notifications?mockDate=2025-08-15"
```

**Live Domains:**
- `perks-reminder.com` / `www.perks-reminder.com` — Main app (credit card benefits)
- `loyalty.perks-reminder.com` — Loyalty program landing page (subdomain detected by middleware, rewrites `/` → `/loyalty-landing`)

**Domains & deployment:** For domain setup details or deployment troubleshooting, see **docs/vercel-domains-and-deploy.md**.

### Database Management

**Production Database**: Neon PostgreSQL with branching
- Main branch: Production data
- Development branch: Safe testing environment
- Point-in-time recovery available for data incidents

**Verify status anytime:**
```bash
npm run db:check     # Shows both prod + dev status in one command
```

**Migration Process (dev-first):**
1. Make schema changes in `prisma/schema.prisma`
2. Create migration on dev: `node scripts/with-dev-db.js npx prisma migrate dev --name your_migration`
3. Test on dev: `npm run dev:devdb`
4. Commit migration files and push to main
5. ✅ Vercel automatically runs `prisma migrate deploy` on production during build

**Operational note for legacy migration drift:**
- If a historical migration fails because objects already exist / do not exist, make the SQL idempotent (`IF EXISTS` / `IF NOT EXISTS`) and use:
  - `npx prisma migrate resolve --rolled-back <migration_name>`
  - then rerun `npx prisma migrate deploy`
- Do **not** use `migrate reset` on shared/prod databases.

**Production changes on request (non-destructive):**
- When the user asks to update production data (e.g., add or refresh predefined cards/benefits):
  1. Verify target: `node scripts/check-database-connection.js` (ensure it reports production/Neon main)
  2. Run non-destructive seed: `DATABASE_URL="<prod>" npx prisma db seed`
  3. For schema already migrated in code, apply to prod: `DATABASE_URL="<prod>" npx prisma migrate deploy`
  4. Never use reset/force-reset commands on production

### Monitoring & Analytics

- **Vercel Analytics**: Built-in performance monitoring
- **Error Tracking**: Console logging with structured error handling
- **User Activity**: Email notification delivery tracking
- **Cron Observability**: Cron routes log attempt time, authorization presence (never log the secret), counts of processed records, and success/failure totals

### Runbooks

- Cron failures: Re-run manually using the commands above; inspect logs for upserts attempted/succeeded/failed; verify `CRON_SECRET` configured in env and Vercel
- Database incident recovery: Follow the Neon CLI workflow in README (“Database Recovery with Neon CLI”) to branch by timestamp, verify, and switch
- Notification testing: Use `send-notifications?mockDate=YYYY-MM-DD` locally with `Authorization: Bearer $CRON_SECRET` (mockDate ignored in production)

---
