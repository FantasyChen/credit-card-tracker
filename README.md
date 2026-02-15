# CouponCycle 💳

**Stop losing hundreds of dollars in credit card benefits every year.**

CouponCycle is a free, open-source tool that tracks your credit card perks and ensures you never miss valuable benefits again. Track, optimize, and maximize your credit card rewards like a pro.

[![CouponCycle Hero](public/hero-image.jpg)](https://www.coupon-cycle.site/)

## 🚀 Try It Now

**[Launch CouponCycle →](https://www.coupon-cycle.site/)**

### 📱 Install on Your Phone
This is a Progressive Web App (PWA) - install it for a native app experience:
- **iPhone/iPad:** Open in Safari → Share → "Add to Home Screen"
- **Android:** Open in Chrome → Menu (⋮) → "Install app"

## ✨ Why CouponCycle?

Credit card users lose an average of **$300-600 annually** by forgetting to use benefits that expire. CouponCycle solves this with:

- **🔔 Smart Notifications** - Get reminders before benefits expire
- **📊 ROI Tracking** - See if your annual fees are worth it
- **🏆 Maximize Rewards** - Track all your cards and loyalty programs in one place
- **📱 Mobile-First** - Works perfectly on your phone
- **🔒 Privacy-Focused** - No ads, no data selling, completely free

## 💡 Perfect For

- **Travel Hackers** - Track airline/hotel credits and free nights
- **Churners** - Manage multiple cards and their unique benefits
- **Busy Professionals** - Automated reminders for dining, Uber, and other credits
- **Anyone with 2+ Credit Cards** - Centralized benefit management

## 🎯 Key Features

- **50+ Predefined Cards** - Chase, Amex, Capital One, and more
- **Smart Notifications** - Email alerts before benefits expire
- **Loyalty Program Tracking** - Monitor airline miles and hotel points
- **Drag & Drop Prioritization** - Organize benefits by importance
- **ROI Analysis** - See if your annual fees are worth it
- **Data Export/Import** - Complete ownership of your information

## 🤝 Help Keep Data Current

Credit card benefits change frequently. **Help keep our data current!**

### Quick Ways to Contribute:
1. **Report outdated info** - Use the in-app suggestion system (`Settings → Suggest`)
2. **Verify benefit amounts** - Check against official bank websites
3. **Add new cards** - Submit popular cards we're missing

**Reliable Sources:**
- [US Credit Card Guide](https://www.uscreditcardguide.com/) (comprehensive)
- [Doctor of Credit](https://www.doctorofcredit.com/) (timely updates)
- Official bank websites (definitive)

## 🛠️ For Developers

### Quick Start
```bash
git clone https://github.com/FantasyChen/credit-card-tracker.git
cd credit-card-tracker
npm install
npx prisma migrate dev
npm run dev
```

### Tech Stack
- **Frontend:** Next.js 15, React 19, Tailwind CSS 4
- **Backend:** Next.js API Routes + Server Actions  
- **Database:** PostgreSQL (Neon main + Neon dev branch)
- **ORM:** Prisma with generated client
- **Auth:** NextAuth.js (Google OAuth)
- **Email:** Resend API for notifications
- **Deployment:** Vercel with automated cron jobs

> **📄 Complete Documentation:** See [AGENTS.md](AGENTS.md) for detailed system architecture, development guidelines, and implementation details.

### Testing
```bash
npm test   # Jest: unit, API routes, server actions, component tests
```

### Database Environments (Dev + Prod)

CouponCycle uses Neon PostgreSQL with two URLs:

- `DATABASE_URL` = production (Neon main branch)
- `DATABASE_URL_DEV` = development branch (safe for testing migrations)

Use this workflow:

```bash
# 1) Verify target before any DB command
node scripts/check-database-connection.js

# 2) Run migrations on dev first
DATABASE_URL="$DATABASE_URL_DEV" npx prisma migrate deploy

# 3) Verify migration state on dev
DATABASE_URL="$DATABASE_URL_DEV" npx prisma migrate status

# 4) Apply to prod only when ready
DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy

# 5) Verify migration state on prod
DATABASE_URL="$DATABASE_URL" npx prisma migrate status
```

Troubleshooting and safety notes are documented in `docs/safe-migration-guide.md`.

### Contribution Guidelines
See our **[Contributing Guide](CONTRIBUTING.md)** for complete development setup, database safety practices, and pull request process.

## 🏠 Self-Hosting

Want complete control over your data? Self-hosting CouponCycle gives you full ownership of your credit card tracking.

```bash
git clone https://github.com/FantasyChen/credit-card-tracker.git
cd credit-card-tracker
npm install
npx prisma migrate deploy
npm run build
npm start
```

**Deployment Options:**
- **Vercel (Recommended):** Connect your GitHub repo - automatic deployments on push
- **Self-hosted:** Deploy anywhere that supports Node.js and PostgreSQL

> **📄 Complete Self-Hosting Guide:** See [AGENTS.md](AGENTS.md) for detailed deployment instructions, environment setup, and troubleshooting.

## 🗺️ What's Next

- [x] **Loyalty Program Tracking** - Points/miles expiration monitoring
- [x] **Progressive Web App** - Native mobile experience
- [x] **Data Export/Import** - Complete data portability
- [ ] **Custom Cards** - Add non-predefined cards and benefits
- [ ] **Advanced Analytics** - Detailed spending and benefit reports
- [ ] **Multi-User Support** - Household account management

Have ideas? [Open an issue](https://github.com/FantasyChen/credit-card-tracker/issues) and let's discuss!

## 💖 Support the Project

CouponCycle is **completely free** with no ads or hidden costs. If it saves you money, consider:

- ⭐ **Starring the repo** - Helps others discover the project
- 🐛 **Reporting issues** - Makes the tool better for everyone  
- 💡 **Contributing updates** - Keep card data current
- ☕ **[Buy me a coffee](https://coff.ee/fantasy_c)** - Supports continued development

## 📄 License & Legal

- **License:** MIT - Free for personal and commercial use
- **Privacy:** [Privacy Policy](PRIVACY.md) - No data selling, minimal collection
- **Terms:** [Terms of Use](TERMS.md) - Standard usage guidelines
- **Code of Conduct:** [Community Standards](CODE_OF_CONDUCT.md)

---

**Built by [@fantasy_c](https://github.com/FantasyChen)** • **[Live App](https://www.coupon-cycle.site/)** • **[Issues](https://github.com/FantasyChen/credit-card-tracker/issues)** • **[Discussions](https://github.com/FantasyChen/credit-card-tracker/discussions)**