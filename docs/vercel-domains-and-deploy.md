# Vercel: Domains & Deployment Troubleshooting

## Adding the Loyalty Subdomain

To make **https://loyalty.coupon-cycle.site** work:

### 1. Add domain in Vercel

1. Open [Vercel Dashboard](https://vercel.com/dashboard) → your **credit-card-tracker** project.
2. Go to **Settings** → **Domains**.
3. Click **Add** and enter: `loyalty.coupon-cycle.site`.
4. Save. Vercel will show the required DNS record (usually a **CNAME** to `cname.vercel-dns.com` or your project’s Vercel hostname).

### 2. Add DNS record at your domain registrar

At the place where **coupon-cycle.site** is registered (e.g. Namecheap, Cloudflare, Vercel Domains):

- **Type:** CNAME  
- **Name:** `loyalty`  
- **Value:** the target Vercel gives you (e.g. `cname.vercel-dns.com`).

If you already use **Vercel nameservers** for `coupon-cycle.site`, you can add the subdomain from the team **Domains** page and Vercel can manage the record.

### 3. Verify

After DNS propagates (minutes to hours), open **https://loyalty.coupon-cycle.site**. You should see the loyalty landing page (same app as www, with middleware rewriting `/` to `/loyalty-landing`).

---

## If the Latest Deployment Failed

### Where to look

1. **Vercel Dashboard** → Project → **Deployments**.
2. Open the **failed** deployment.
3. Check:
   - **Build logs** (full output of `prisma generate`, `prisma migrate deploy`, `next build`).
   - **Runtime logs** (if the failure is after build).

### Common causes for this project

| Cause | What you see | Fix |
|-------|----------------------|-----|
| **Database timeout** | `prisma migrate deploy` or DB connection times out during build | Neon can be slow to wake. Retry the deployment once or twice. Ensure `DATABASE_URL` in Vercel env is the **pooler** URL (e.g. `-pooler` in host). |
| **Wrong workspace root** | Next.js warns about “multiple lockfiles” and uses a parent directory | Fixed in this repo with `outputFileTracingRoot` in `next.config.ts`. Ensure that change is deployed. |
| **Missing env vars** | Build or runtime fails on missing `DATABASE_URL`, `NEXTAUTH_SECRET`, etc. | In Vercel → Settings → Environment Variables, add every variable from `.env.example` (and any extra prod-only ones). |
| **Prisma generate path** | Errors about `@prisma/client` or generated client | Build command must run `prisma generate` before `next build` (current: `prisma generate && prisma migrate deploy && next build`). |
| **Node / npm version** | Incompatible Node or lockfile issues | In Vercel → Settings → General, set **Node.js Version** (e.g. 20.x). |

### Re-run a failed deployment

- In the deployment page, click **Redeploy** (same commit) to retry without a new push.
- If the failure is intermittent (e.g. DB timeout), a second deploy often succeeds.

---

## Build command (reference)

Current production build command:

```bash
prisma generate && prisma migrate deploy && next build
```

So every deploy runs migrations on the database pointed to by `DATABASE_URL` in Vercel. Use a **production** DB URL there; do not point Vercel at a dev branch for live traffic.
