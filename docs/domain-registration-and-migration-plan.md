# Domain Registration and Migration Plan

## Target

Register and migrate the app to:

```text
perks-reminder.com
```

The current production domain is:

```text
coupon-cycle.site
```

The current loyalty subdomain is:

```text
loyalty.coupon-cycle.site
```

## Registration Decision

Use **Spaceship** as the registrar for the first year because it appears to be the cheapest reasonable `.com` option for this domain.

Expected pricing:

- First year: about `$5.87` with promo code `COM67`
- Renewal: about `$9.98` per year
- Possible ICANN fee: about `$0.20`

Avoid paid add-ons such as hosting, email, SSL, website builder, or privacy upsells. Only register the domain.

## Purchase Steps

1. Go to <https://www.spaceship.com/domains/>.
2. Search for `perks-reminder.com`.
3. Confirm the domain is available.
4. Add only `perks-reminder.com` to the cart.
5. Apply promo code:

```text
COM67
```

6. Verify the final first-year price is around `$5.87`, plus any required ICANN fee.
7. Do not add hosting, email, SSL, website builder, or other paid services.
8. Stop before final purchase/payment submission.
9. Ask the user for explicit confirmation before completing checkout.

## Safety Rule

The next agent must not click the final purchase/payment button without explicit user confirmation at checkout.

## DNS and Vercel Setup

After the domain is purchased:

1. Add `perks-reminder.com` to the Vercel project domains.
2. Add `www.perks-reminder.com` if desired.
3. Configure the DNS records Vercel provides.
4. Decide whether to manage DNS in Spaceship, Cloudflare, or Vercel.

Recommended setup:

- Registrar: Spaceship
- DNS/CDN: Cloudflare or Vercel DNS
- Hosting: existing Vercel project

## Old Domain Strategy

Keep `coupon-cycle.site` active during migration.

Set up redirects:

```text
coupon-cycle.site -> perks-reminder.com
www.coupon-cycle.site -> www.perks-reminder.com
```

For the loyalty subdomain, choose one of these:

1. Keep `loyalty.coupon-cycle.site` temporarily and redirect later.
2. Create `loyalty.perks-reminder.com`.
3. Move loyalty into a path such as `perks-reminder.com/loyalty`.

Recommended: create `loyalty.perks-reminder.com` for consistency, while keeping the old loyalty subdomain redirected for 6-12 months.

## Code and Configuration Updates

After the new domain is available, update these areas:

- `NEXTAUTH_URL`
- OAuth callback URLs for Google, GitHub, and Facebook
- Auth cookie domain logic in `src/lib/auth.ts`
- Site metadata in Next.js layout files
- Sitemap and robots configuration
- Footer and navbar links
- Email links and notification URLs
- PWA manifest if it references the old domain
- README and docs references
- Vercel domain configuration

Important known code reference:

```text
src/lib/auth.ts
```

This file contains domain-specific auth cookie logic for `coupon-cycle.site`.

## User Communication Plan

Before switching:

1. Add an in-app banner:

```text
CouponCycle is moving to perks-reminder.com. Your account and data will stay the same.
```

2. Send an email announcement to users.
3. Mention that existing links will continue to redirect.

After switching:

1. Keep redirects active for at least 6-12 months.
2. Keep a short banner on the new domain for returning users.
3. Monitor login, OAuth, email links, and loyalty subdomain behavior.

## Migration Checklist

- [ ] Register `perks-reminder.com`.
- [ ] Add domain to Vercel.
- [ ] Configure DNS records.
- [ ] Verify HTTPS works.
- [ ] Update environment variables.
- [ ] Update OAuth callback URLs.
- [ ] Update code references.
- [ ] Update docs and README.
- [ ] Add old-domain redirects.
- [ ] Add user-facing migration banner.
- [ ] Send user announcement email.
- [ ] Test login on root domain.
- [ ] Test login on loyalty subdomain or loyalty route.
- [ ] Test email notification links.
- [ ] Keep old domain active for 6-12 months.
