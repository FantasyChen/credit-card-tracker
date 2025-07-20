# Credit Card Tracker 💳

**Tired of losing hundreds of dollars in credit card benefits each year? So was I.** That's why I built this free, open-source tool to help you track your credit card perks and maximize your rewards.

[![Credit Card Tracker Hero Image](public/images/hero-image.jpg)](https://credit-card-tracker.vercel.app/)

*Stop letting your benefits expire. Start tracking them like a pro.*

## ✨ Why Use Credit Card Tracker?

This isn't just another expense tracker. It's a smart benefits management system designed for anyone who wants to get the most out of their credit cards.

- **Never Miss a Deadline:** Get automated reminders before your benefits expire.
- **See Your Real ROI:** Instantly know if your card's annual fee is paying for itself.
- **All Your Cards in One Place:** A central dashboard for all your credit cards and their unique perks.
- **Track Your Loyalty Points:** Keep an eye on your points and miles so they don't disappear.
- **It's Free & Private:** No ads, no selling your data. Just a powerful tool for your benefit.

## 🚀 Live App & Installation

You can use the live application right now at **[credit-card-tracker.vercel.app](https://credit-card-tracker.vercel.app/)**.

### For Your Mobile Device (Recommended)

This is a Progressive Web App (PWA), which means you can install it on your phone for a native app-like experience.

- **iPhone/iPad:** Open the site in Safari, tap the 'Share' button, and select "Add to Home Screen".
- **Android:** Open the site in Chrome, tap the three-dot menu, and select "Install app".

## 🛠️ For Developers: Quick Start & Contribution

<details>
<summary><strong>Click here for development setup and contribution guide</strong></summary>

### Tech Stack

- **Frontend:** Next.js 15, React 19, Tailwind CSS
- **Backend:** Next.js API Routes, Prisma ORM
- **Database:** PostgreSQL (production), SQLite (development)
- **Authentication:** NextAuth.js with Google OAuth
- **Email:** Resend API for notifications
- **Deployment:** Vercel with automated cron jobs

### Prerequisites

- Node.js 18+
- npm or yarn
- PostgreSQL (for production) or SQLite (for development)

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/FantasyChen/credit-card-tracker.git
    cd credit-card-tracker
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Set up environment variables**
    ```bash
    # Create .env file with your configuration
    # See Required Environment Variables section below
    ```

4.  **Set up the database**
    ```bash
    # Generate Prisma client
    npx prisma generate

    # Run migrations
    npx prisma migrate dev

    # Seed the database with predefined cards
    npx prisma db seed
    ```

5.  **Start development server**
    ```bash
    npm run dev
    ```

6.  **Open your browser**
    Navigate to [http://localhost:3000](http://localhost:3000)

### Required Environment Variables

- `DATABASE_URL` - Your database connection string
- `NEXTAUTH_URL` - Your app URL (http://localhost:3000 for development)
- `NEXTAUTH_SECRET` - Random secret for NextAuth.js
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `CRON_SECRET` - Secret for securing cron job endpoints
- `RESEND_API_KEY` - Resend API key for email notifications

### Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on how to get started.

</details>

## 💖 A Note from the Creator

Hi, I'm fantasy_c. I'm an indie developer passionate about creating free tools that help people improve their lives. This project was born out of my own frustration with managing credit card benefits, and I'm sharing it with the world in the hopes that it helps you too.

My goal is to build things that are genuinely useful, without ads or hidden costs. If you find this tool valuable, consider [supporting my work](https://www.buymeacoffee.com/your-link-here).

## 🗺️ Roadmap

We're just getting started! Here's what's planned:

- [x] Loyalty program tracking and notifications
- [x] Progressive Web App support
- [ ] Custom card and benefit creation
- [ ] Data export/import functionality
- [ ] Advanced analytics and reporting
- [ ] Bank account integration
- [ ] Multi-user households

Have an idea? [Open an issue](https://github.com/FantasyChen/credit-card-tracker/issues) and let's talk about it!

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 