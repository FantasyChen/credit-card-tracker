# Contributing to CouponCycle

Thank you for considering contributing to CouponCycle! 🎉 This guide provides detailed information for developers and contributors who want to help improve the project.

## 📋 Table of Contents

- [Development Setup](#development-setup)
- [Updating Credit Card Information](#updating-credit-card-information)
- [Development Guidelines](#development-guidelines)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Issue Guidelines](#issue-guidelines)
- [Pull Request Process](#pull-request-process)

## 🚀 Development Setup

### Prerequisites

Before you begin, ensure you have:
- Node.js 18 or higher
- npm or yarn package manager
- Git for version control
- A Google account (for OAuth testing)
- Basic knowledge of React, Next.js, and TypeScript

### Detailed Setup Instructions

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/your-username/credit-card-tracker.git
   cd credit-card-tracker
   npm install
   ```

2. **Environment Configuration**
   Create `.env` from the template and fill in all values:
   ```bash
   cp .env.example .env
   ```

   **Required Environment Variables:**
   ```bash
   # Database
   DATABASE_URL="postgresql://..." # Production
   DATABASE_URL_DEV="postgresql://..." # Development branch

   # Authentication  
   GOOGLE_CLIENT_ID="your-google-client-id"
   GOOGLE_CLIENT_SECRET="your-google-client-secret"
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-nextauth-secret"

   # Services
   RESEND_API_KEY="your-resend-api-key"
   CRON_SECRET="your-cron-secret"
   SERPAPI_API_KEY="your-serpapi-key" # For card image downloads
   ```

3. **Database Setup**
   ```bash
   npx prisma generate
   npx prisma migrate dev
   npx prisma db seed
   npm run dev
   ```

### Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes and cron jobs
│   ├── benefits/          # Benefits dashboard
│   ├── cards/            # Card management
│   ├── loyalty/          # Loyalty program tracking
│   └── settings/         # User preferences
├── components/           # Reusable React components
├── lib/                 # Core business logic
│   ├── actions/         # Server actions
│   ├── benefit-cycle.ts # Benefit cycle calculations
│   └── auth.ts          # Authentication config
└── types/               # TypeScript definitions
```

### Helpful Development Scripts

```bash
# List available predefined cards
node scripts/list-available-cards.cjs

# Download a card image into public/images/cards/
node scripts/download-card-image.js --name "Chase Sapphire Preferred"

# DB connection check and environment verification
node scripts/check-database-connection.js

# Validate benefit ordering and ROI logic
node scripts/test-drag-drop.cjs
node scripts/test-annual-fee-roi.cjs

# Test email sending (requires RESEND_API_KEY)
node scripts/test-email.cjs
```

## 💳 Updating Credit Card Information

**This is one of the most valuable ways to contribute!** Credit card benefits and annual fees change frequently, and community help is essential.

### 📚 Reliable Sources (In Order of Preference)

1. **Official bank websites** (chase.com, americanexpress.com, etc.)
2. **[US Credit Card Guide](https://www.uscreditcardguide.com/)** - Comprehensive benefit details
3. **[Doctor of Credit](https://www.doctorofcredit.com/)** - Timely updates and changes
4. **Bank press releases** - Official announcements

### 📋 What to Update

#### High Priority:
- **Annual fee changes** - Banks adjust these regularly
- **Benefit value changes** - Credit amounts often change
- **New benefits added** - Cards frequently add perks
- **Benefits removed** - Important to remove discontinued perks
- **Benefit frequency changes** - From monthly to quarterly, etc.

#### Medium Priority:
- **Benefit description clarifications**
- **New credit cards from major issuers**
- **Discontinued cards** - Mark as no longer available

### 🛠️ Two Ways to Contribute Updates

#### Option A: In-App Suggestion System (Recommended)
1. Sign in to [CouponCycle](https://www.coupon-cycle.site/)
2. Go to `Settings → Suggest`
3. Submit a JSON payload with your updates and source links
4. Moderators review suggestions in `Settings → Review`

#### Option B: Direct Code Changes
1. **Locate the card in `prisma/seed.ts`**
2. **Update the information following our criteria**
3. **Test your changes**
4. **Submit a pull request**

### 📝 Benefit Inclusion Criteria

**Include These:**
- Cyclical benefits with trackable resets (monthly/quarterly/yearly)
- Statement credits with specific dollar amounts
- Free nights, upgrades, or services with clear cycles
- Benefits that users can "use up" and then reset

**Exclude These:**
- Always-on perks (points multipliers, insurance, status)
- Memberships without cycles (Priority Pass, lounge access)
- One-time signup bonuses
- Benefits without specific dollar values

**Example of Good Benefits:**
```typescript
{
  description: '$300 Annual Travel Credit',
  category: 'Travel',
  maxAmount: 300,
  frequency: BenefitFrequency.YEARLY,
  percentage: 0,
}
```

### 🧪 Testing Card Updates

```bash
# Verify seed data is valid
npx prisma db seed

# Build to check for errors
npm run build

# Check what cards are available
node scripts/list-available-cards.cjs
```

### 📤 Pull Request Guidelines for Card Updates

#### PR Title Format:
`Update [Card Name]: [Brief description]`

#### PR Description Template:
```markdown
## Card Information Update

**Card**: Chase Sapphire Preferred
**Issuer**: Chase

### Changes Made:
- [ ] Annual fee updated ($95 → $120)
- [ ] New benefit added: $60 Annual DoorDash Credit
- [ ] Existing benefit modified: Hotel credit increased to $60

### Source Verification:
- [x] Verified with official Chase website
- [x] Cross-checked with US Credit Card Guide
- [x] Source: https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred

### Testing:
- [x] Seed data runs without errors
- [x] Build completes successfully
```

## 🔧 Development Guidelines

### Code Standards

```bash
# Before submitting any PR
npm run lint
npm test
npm run build
```

### Naming Conventions
- **Components**: PascalCase (`BenefitCard.tsx`)
- **Files**: kebab-case (`benefit-cycle.ts`)
- **Variables**: camelCase (`benefitAmount`)
- **Database**: snake_case (`created_at`)

### TypeScript Guidelines
- Use strict TypeScript configuration
- Define proper types for all props and function parameters
- Avoid `any` type - use proper typing
- Use Prisma-generated types when possible

### Component Guidelines
- Use functional components with hooks
- Keep components small and focused
- Use proper prop types
- Handle loading and error states
- Follow accessibility best practices

## 🧪 Testing

### Writing Tests
- Write tests for new features and bug fixes
- Use descriptive test names
- Test both happy path and edge cases
- Mock external dependencies appropriately

### Running Tests
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage
```

### Test Structure
```typescript
describe('BenefitCard Component', () => {
  it('should display benefit information correctly', () => {
    // Test implementation
  });

  it('should handle missing data gracefully', () => {
    // Test implementation
  });
});
```

## 📤 Submitting Changes

### Before Submitting
1. **Test thoroughly** - Run all tests and build
2. **Update documentation** if needed
3. **Add tests** for new functionality
4. **Check accessibility** compliance
5. **Follow code standards**

### Commit Guidelines
Use clear, descriptive commit messages following conventional commits:

```bash
# Examples
git commit -m "feat: add drag and drop benefit reordering"
git commit -m "fix: correct annual fee calculation for multiple cards"
git commit -m "docs: update setup instructions for new contributors"

# Format: type(scope): description
# Types: feat, fix, docs, style, refactor, test, chore
```

## 🐛 Issue Guidelines

### Reporting Bugs
Include:
- **Clear title** and description
- **Steps to reproduce** the issue
- **Expected vs actual behavior**
- **Screenshots** if applicable
- **Environment details** (OS, browser, Node version)
- **Error messages** if any

### Feature Requests
Provide:
- **Clear use case** for the feature
- **Detailed description** of proposed functionality
- **Mockups or wireframes** if applicable
- **Consideration of alternatives**

## 🔄 Pull Request Process

### PR Checklist
- [ ] Branch is up to date with main
- [ ] All tests pass
- [ ] Build completes successfully
- [ ] Documentation is updated
- [ ] PR description explains the changes
- [ ] Related issues are referenced

### PR Description Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactoring

## Testing
- [ ] Unit tests added/updated
- [ ] Manual testing completed
- [ ] All existing tests pass

## Screenshots
If applicable, add screenshots

## Related Issues
Fixes #123
```

### Review Process
1. **Automated checks** must pass
2. **Code review** by maintainers
3. **Testing** by maintainers
4. **Approval** and merge

## 📞 Getting Help

- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - General questions and discussions
- **Email** - Contact form on website for sensitive issues

### Response Times
- **Critical bugs** - Within 24 hours
- **General issues** - Within 1 week
- **Pull requests** - Within 1 week

Thank you for contributing to CouponCycle! 🚀