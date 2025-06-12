# CouponCycle 💳

A smart credit card benefits tracking application that helps you maximize your rewards and never miss valuable perks.

![CouponCycle Hero](public/images/hero-image.jpg)

## 🚀 Features

- **📊 Automated Benefit Tracking** - Track monthly, quarterly, and yearly credit card benefits
- **🏆 Loyalty Program Management** - Track 12+ major loyalty programs with expiration monitoring
- **💰 ROI Analysis** - See if your annual fees are worth it with real-time ROI calculations  
- **🔔 Smart Notifications** - Get email reminders before benefits and loyalty points expire
- **📱 Progressive Web App** - Install as native app on iPhone and Android devices
- **🌙 Dark Mode** - Automatic theme switching based on system preference
- **🎯 Drag & Drop** - Customize benefit order with intuitive reordering
- **🔒 Secure** - Google OAuth authentication with NextAuth.js

## 🛠️ Tech Stack

- **Frontend:** Next.js 15, React 19, Tailwind CSS
- **Backend:** Next.js API Routes, Prisma ORM  
- **Database:** PostgreSQL (production), SQLite (development)
- **Authentication:** NextAuth.js with Google OAuth
- **Email:** Resend API for notifications
- **Deployment:** Vercel with automated cron jobs

## 🏃‍♂️ Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- PostgreSQL (for production) or SQLite (for development)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/FantasyChen/credit-card-tracker.git
   cd credit-card-tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   # Create .env file with your configuration
   # See Required Environment Variables section below
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma client
   npx prisma generate
   
   # Run migrations
   npx prisma migrate dev
   
   # Seed the database with predefined cards
   npx prisma db seed
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🔧 Configuration

### Required Environment Variables

- `DATABASE_URL` - Your database connection string
- `NEXTAUTH_URL` - Your app URL (http://localhost:3000 for development)
- `NEXTAUTH_SECRET` - Random secret for NextAuth.js
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `CRON_SECRET` - Secret for securing cron job endpoints
- `RESEND_API_KEY` - Resend API key for email notifications

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized origins and redirect URIs

## 📖 Documentation

Comprehensive documentation is available in the `/docs` folder:

- [Design Document](docs/DESIGN.md) - Architecture and technical decisions
- [Development Plan](docs/PLAN.md) - Roadmap and next steps  
- [Setup Guide](docs/README.md) - Detailed setup instructions
- [Marketing Guide](docs/MARKETING.md) - Go-to-market strategy

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests if applicable
5. Ensure the build passes (`npm run build`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Test the build
npm run build
```

## 📦 Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Manual Deployment

```bash
# Build the application
npm run build

# Start production server
npm start
```

## 🛡️ Security

- Report security vulnerabilities privately via GitHub issues or email
- All API endpoints are properly secured
- Environment variables are never exposed to the client

## 📊 Project Stats

- **Languages:** TypeScript, JavaScript
- **Database:** PostgreSQL with Prisma ORM
- **Authentication:** Google OAuth via NextAuth.js
- **Styling:** Tailwind CSS with custom components
- **Testing:** Jest with Testing Library

## 📱 Mobile Installation

### iPhone/iPad (Safari)
1. Open the website in Safari
2. Tap the Share button (square with arrow up)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add"

### Android (Chrome)
1. Open the website in Chrome
2. Tap the three dots menu (⋮)
3. Tap "Add to Home screen" or "Install app"
4. Tap "Add" or "Install"

## 🗺️ Roadmap

- [x] Loyalty program tracking and notifications
- [x] Progressive Web App support
- [ ] Custom card and benefit creation
- [ ] Data export/import functionality  
- [ ] Advanced analytics and reporting
- [ ] Bank account integration
- [ ] Multi-user households

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Credit card data sourced from [US Credit Card Guide](https://www.uscreditcardguide.com/)
- Icons from [Heroicons](https://heroicons.com/)
- UI components inspired by [shadcn/ui](https://ui.shadcn.com/)

## 💬 Support

- 🐛 [Report bugs](https://github.com/FantasyChen/credit-card-tracker/issues)
- 💡 [Request features](https://github.com/FantasyChen/credit-card-tracker/issues)
- 💬 [Join discussions](https://github.com/FantasyChen/credit-card-tracker/discussions)

---

**Made with ❤️ for credit card enthusiasts who want to maximize their rewards.** 