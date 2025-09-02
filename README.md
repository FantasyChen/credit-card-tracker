# CouponCycle 💳

**Stop losing hundreds of dollars in credit card benefits every year.** CouponCycle is a free, open-source tool that tracks your credit card perks and ensures you never miss valuable benefits again.

[![CouponCycle Hero](public/hero-image.jpg)](https://www.coupon-cycle.site/)

*Track, optimize, and maximize your credit card rewards like a pro.*

## 🚀 Try It Now

**[Launch CouponCycle →](https://www.coupon-cycle.site/)**

### Install on Your Phone (Recommended)
This is a Progressive Web App (PWA) - install it for a native app experience:
- **iPhone/iPad:** Open in Safari → Share → "Add to Home Screen"
- **Android:** Open in Chrome → Menu (⋮) → "Install app"

## ✨ Why CouponCycle?

Credit card users lose an average of **$300-600 annually** by forgetting to use benefits that expire. CouponCycle solves this by:

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

### Credit Card Management
- Track benefits from 50+ predefined cards (Chase, Amex, Capital One, etc.)
- Custom opening dates for accurate benefit cycles
- Drag-and-drop benefit prioritization
- Annual fee ROI analysis

### Smart Notifications
- Email alerts before benefits expire
- Daily digest of available benefits
- Loyalty program expiration warnings

### Loyalty Program Tracking
- Monitor airline miles and hotel points
- Track expiration dates and activity requirements
- Multi-program support (airlines, hotels, rental cars)

### Data Control
- Export/import all your data
- No vendor lock-in
- Complete ownership of your information

## 🤝 Community Contributions Welcome!

Credit card benefits change frequently. **Help keep our data current!**

### Quick Ways to Contribute:
1. **Report outdated info** - Use the in-app suggestion system (`Settings → Suggest`)
2. **Verify benefit amounts** - Check against official bank websites
3. **Add new cards** - Submit popular cards we're missing

### Most Needed Updates:
- **Annual fee changes** - Banks adjust these regularly
- **Benefit amount updates** - Credits often increase/decrease
- **New card launches** - Major issuer releases
- **Seasonal changes** - Quarterly benefit modifications

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
cp .env.example .env  # Fill in your values
npx prisma migrate dev
npm run dev
```

### Tech Stack
- **Frontend:** Next.js 15 (App Router), React 19, Tailwind CSS 4
- **Backend:** Next.js API Routes + Server Actions  
- **Database:** PostgreSQL (Neon), SQLite (development)
- **ORM:** Prisma with generated client
- **Auth:** NextAuth.js (Google OAuth)
- **Email:** Resend API for notifications
- **Deployment:** Vercel with automated cron jobs
- **Testing:** Jest with Testing Library

> **📄 Complete Architecture:** See [AGENT.md](AGENT.md#technology-stack) for detailed system architecture and implementation details.

### Contribution Guidelines
See our **[Detailed Contributing Guide](CONTRIBUTING.md)** for:
- Complete development setup
- Database safety practices
- Credit card data update procedures
- Code standards and testing
- Pull request process

## 🏠 Self-Hosting

Want complete control over your data? Self-hosting CouponCycle gives you full ownership of your credit card tracking.

**Quick Start:**
```bash
git clone https://github.com/FantasyChen/credit-card-tracker.git
cd credit-card-tracker
npm install
cp .env.example .env  # Fill in your values
```

> **📄 Complete Self-Hosting Guide:** See [AGENT.md](AGENT.md#deployment--operations) for detailed deployment instructions, environment setup, security best practices, and troubleshooting.

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