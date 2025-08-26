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
git clone https://github.com/fantasy-cc/credit-card-tracker.git
cd credit-card-tracker
npm install
cp .env.example .env  # Fill in your values
npx prisma migrate dev
npm run dev
```

### Tech Stack
- **Frontend:** Next.js 15, React 19, Tailwind CSS
- **Backend:** Next.js API Routes, Prisma ORM
- **Database:** PostgreSQL (Neon), SQLite (dev)
- **Auth:** NextAuth.js (Google OAuth)
- **Deployment:** Vercel

### Contribution Guidelines
See our **[Detailed Contributing Guide](CONTRIBUTING.md)** for:
- Complete development setup
- Database safety practices
- Credit card data update procedures
- Code standards and testing
- Pull request process

## 🏠 Self-Hosting

Want complete control over your data? Self-hosting CouponCycle is straightforward and gives you full ownership of your credit card tracking.

### 🎯 Why Self-Host?
- **Complete Data Privacy** - Your financial data never leaves your server
- **Custom Modifications** - Tailor the app to your specific needs
- **No Third-Party Dependencies** - Full control over uptime and performance
- **Educational Value** - Learn about web app deployment and management

### 📋 Prerequisites

Before you begin, you'll need:
- **Server/VPS** with Node.js 18+ support
- **PostgreSQL Database** (local or cloud)
- **Domain Name** (optional but recommended)
- **Email Service** (Resend, SendGrid, or similar)
- **Google OAuth App** (for authentication)

### 🚀 Deployment with Vercel

The easiest way to self-host CouponCycle is with Vercel, which provides automatic deployments and built-in cron job support.

1. **Fork the repository** on GitHub

2. **Create required accounts**:
   - [Vercel](https://vercel.com/) for hosting
   - [Neon](https://neon.tech/) for PostgreSQL database
   - [Resend](https://resend.com/) for email notifications
   - [Google Cloud Console](https://console.cloud.google.com/) for OAuth

3. **Set up PostgreSQL database**:
   - Create a Neon database and get your connection string
   - It will look like: `postgresql://username:password@ep-xxx.neon.tech/dbname`

4. **Configure Google OAuth**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create new project → Enable Google+ API
   - Create OAuth 2.0 credentials
   - Add your Vercel domain to authorized origins

5. **Deploy to Vercel**:
   - Connect your GitHub fork to Vercel
   - Add environment variables in the Vercel dashboard (see configuration below)
   - Deploy! Vercel will automatically run database migrations

6. **Your app will be live** at `https://your-app.vercel.app`

> **Alternative Platforms:** CouponCycle can also be deployed on Railway, DigitalOcean, Render, Fly.io, or using Docker. The Vercel approach is recommended for its simplicity and automatic cron job support.

### ⚙️ Environment Configuration

**Required Environment Variables:**
```bash
# Database
DATABASE_URL="postgresql://user:pass@host:5432/dbname"

# Authentication
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="your-super-secret-key" # Generate with: openssl rand -base64 32
GOOGLE_CLIENT_ID="your-google-oauth-client-id"
GOOGLE_CLIENT_SECRET="your-google-oauth-secret"

# Email Notifications
RESEND_API_KEY="re_xxxxxxxxxx" # From resend.com

# Security
CRON_SECRET="another-random-secret" # For cron job authentication
```

**Optional but Recommended:**
```bash
# Card image downloads (if you plan to add new cards)
SERPAPI_API_KEY="your-serpapi-key"

# Development branch (for safe testing)
DATABASE_URL_DEV="postgresql://dev-connection-string"
```

### 🔒 Security Best Practices

**Vercel handles most security automatically**, but follow these best practices:

1. **Environment Variables** - Never commit secrets to your repository
2. **Strong Secrets** - Generate secure values for `NEXTAUTH_SECRET` and `CRON_SECRET`:
```bash
   # Generate secure secrets
   openssl rand -base64 32
   ```
3. **Database Security** - Use strong passwords and enable SSL (Neon enables this by default)
4. **Regular Updates** - Keep dependencies updated:
```bash
   npm audit && npm audit fix
   ```
5. **Custom Domain** - Use your own domain with HTTPS (Vercel provides SSL automatically)

### ⏰ Cron Jobs Setup

CouponCycle requires two daily cron jobs for proper functionality. **Vercel automatically handles these** based on the `vercel.json` configuration in the repository:

- `/api/cron/check-benefits` - Daily at 5:00 AM UTC
- `/api/cron/send-notifications` - Daily at 5:15 AM UTC

**No additional setup required** for Vercel deployments! The cron jobs will run automatically once deployed.

**Manual Testing:**
```bash
# Test the cron endpoints manually (useful for debugging)
curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/check-benefits
curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/send-notifications
```

### 🧹 Maintenance

**Regular Tasks:**
- **Monitor Vercel dashboard** for deployment status and function logs
- **Update dependencies** monthly: `npm audit && npm update` in your fork
- **Check Neon database** dashboard for usage and performance
- **Monitor email delivery** through Resend dashboard
- **Review GitHub Dependabot** alerts for security updates

**Health Checks:**
```bash
# Test cron endpoints manually (replace with your domain)
curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/check-benefits
```

### 🆘 Troubleshooting

**Common Issues:**

1. **Database Connection Failed**
   - Check your `DATABASE_URL` in Vercel environment variables
   - Verify Neon database is active and accessible

2. **OAuth Errors**
   - Verify redirect URIs in Google Console match your Vercel domain
   - Check that `NEXTAUTH_URL` points to your Vercel app URL

3. **Email Not Sending**
   - Verify `RESEND_API_KEY` is valid in Vercel environment variables
   - Check Resend dashboard for delivery status

4. **Cron Jobs Not Running**
   - Check Vercel Functions tab for cron job execution logs
   - Verify `CRON_SECRET` is set correctly

### 💡 Pro Tips

- **Fork first** - Always work from your own fork for easy updates
- **Use Vercel preview deployments** - Test changes before merging to main
- **Monitor Vercel analytics** - Built-in performance monitoring
- **Set up Vercel notifications** - Get alerts for deployment failures
- **Use custom domain** - Better for production use than `.vercel.app` subdomain

**Need Help?** Check Vercel's function logs first, then open an issue on GitHub with details about any errors you're encountering.

## 🗺️ What's Next

- [x] **Loyalty Program Tracking** - Points/miles expiration monitoring
- [x] **Progressive Web App** - Native mobile experience
- [x] **Data Export/Import** - Complete data portability
- [ ] **Custom Cards** - Add non-predefined cards and benefits
- [ ] **Advanced Analytics** - Detailed spending and benefit reports
- [ ] **Multi-User Support** - Household account management

Have ideas? [Open an issue](https://github.com/fantasy-cc/credit-card-tracker/issues) and let's discuss!

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

**Built by [@fantasy_c](https://github.com/fantasy-cc)** • **[Live App](https://www.coupon-cycle.site/)** • **[Issues](https://github.com/fantasy-cc/credit-card-tracker/issues)** • **[Discussions](https://github.com/fantasy-cc/credit-card-tracker/discussions)**