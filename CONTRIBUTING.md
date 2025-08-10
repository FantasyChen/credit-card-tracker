# Contributing to CouponCycle

First off, thank you for considering contributing to CouponCycle! 🎉

CouponCycle is a community-driven project, and we welcome contributions from developers of all skill levels. Whether you're fixing bugs, adding features, improving documentation, or helping with testing, your contribution is valuable.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Updating Credit Card Information](#updating-credit-card-information)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Submitting Changes](#submitting-changes)
- [Issue Guidelines](#issue-guidelines)
- [Pull Request Process](#pull-request-process)

## 🤝 Code of Conduct

This project follows standard open source community guidelines. Please be respectful, inclusive, and constructive in all interactions. See our [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have:

- Node.js 18 or higher
- npm or yarn package manager
- Git for version control
- A Google account (for OAuth testing)
- Basic knowledge of React, Next.js, and TypeScript

### Development Setup

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/credit-card-tracker.git
   cd credit-card-tracker
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Fill in your environment variables
   ```

5. **Set up the database**:
   ```bash
   npx prisma generate
   npx prisma migrate dev
   npx prisma db seed
   ```

6. **Start the development server**:
   ```bash
   npm run dev
   ```

7. **Verify the setup** by visiting http://localhost:3000

## 🛠️ How to Contribute

### Types of Contributions

We welcome several types of contributions:

- **🐛 Bug Reports** - Help us identify and fix issues
- **✨ Feature Requests** - Suggest new functionality
- **💻 Code Contributions** - Implement features or fix bugs
- **📚 Documentation** - Improve or add documentation
- **🧪 Testing** - Write tests or improve test coverage
- **🎨 Design** - UI/UX improvements
- **🔍 Code Review** - Review pull requests

### Good First Issues

Look for issues labeled `good first issue` or `help wanted`. These are typically:
- Bug fixes
- Documentation improvements
- Small feature additions
- Test additions

## 💻 Development Setup

### Project Structure

```
credit-card-tracker/
├── src/
│   ├── app/           # Next.js app router pages
│   ├── components/    # Reusable React components
│   ├── lib/          # Utility functions and configurations
│   └── types/        # TypeScript type definitions
├── prisma/           # Database schema and migrations
├── public/           # Static assets
├── docs/             # Project documentation
└── scripts/          # Utility scripts
```

### Helpful Scripts

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

### Key Technologies

- **Next.js 15** - React framework with App Router
- **Prisma** - Database ORM
- **NextAuth.js** - Authentication
- **Tailwind CSS** - Styling
- **TypeScript** - Type safety
- **Jest** - Testing framework

## 🔄 Updating Credit Card Information

**This is one of the most valuable ways to contribute!** Credit card benefits and annual fees change frequently, and community help is essential to keep our data current.

### 📚 Reliable Sources for Card Information

Always verify information with these trusted sources (in order of preference):

1. **Official bank websites** (chase.com, americanexpress.com, etc.)
2. **[US Credit Card Guide](https://www.uscreditcardguide.com/)** - Excellent for comprehensive benefit details
3. **[Doctor of Credit](https://www.doctorofcredit.com/)** - Great for tracking changes and updates
4. **Bank press releases** - For official announcements of changes

### 📋 What Information to Update

#### High Priority Updates:
- **Annual fee changes** - Banks adjust these regularly
- **Benefit value changes** - Credit amounts often change
- **New benefits added** - Cards frequently add perks
- **Benefits removed** - Important to remove discontinued perks
- **Benefit frequency changes** - From monthly to quarterly, etc.

#### Medium Priority Updates:
- **Benefit description clarifications** - More accurate wording
- **New credit cards** - Major issuers release new cards
- **Discontinued cards** - Mark cards no longer available

### 🛠️ How to Update Card Information

#### Step 1: Identify Changes
Compare our current data with official sources:

```bash
# See what cards we currently have
node scripts/list-available-cards.cjs
```

#### Step 2: Locate the Card in Code
All card data is in `prisma/seed.ts`. Find the card you want to update:

```typescript
// Example: Finding Chase Sapphire Preferred
{
  name: 'Chase Sapphire Preferred',
  issuer: 'Chase',
  annualFee: 95,
  imageUrl: '/images/cards/chase-sapphire-preferred.png',
  benefits: [
    // Benefits are listed here
  ]
}
```

#### Step 3: Update the Information
Make your changes following our data criteria:

**Annual Fee:**
```typescript
annualFee: 95, // Update to current fee
```

**Benefits - Follow These Rules:**
1. **Only trackable, cyclical benefits** (monthly, quarterly, yearly)
2. **Specific dollar amounts** - avoid vague benefits
3. **No always-on perks** (like points multipliers)

```typescript
benefits: [
  {
    description: '$300 Annual Travel Credit', // Clear, specific description
    category: 'Travel', // Travel, Dining, Entertainment, etc.
    maxAmount: 300, // Dollar amount per cycle
    frequency: BenefitFrequency.YEARLY, // MONTHLY, QUARTERLY, YEARLY
    percentage: 0, // Usually 0 for statement credits
  }
]
```

#### Step 4: Test Your Changes
```bash
# Test that the seed data is valid
npx prisma db seed

# Build the project to ensure no errors
npm run build
```

### 📝 Pull Request Guidelines for Card Updates

#### PR Title Format:
- `Update [Card Name]: [Brief description]`
- Example: `Update Chase Sapphire Preferred: Increase annual fee to $95`

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
- [ ] Verified with official Chase website
- [ ] Cross-checked with US Credit Card Guide
- [x] Link to source: https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred

### Testing:
- [x] Seed data runs without errors
- [x] Build completes successfully
```

#### What We'll Review:
1. **Source verification** - Is the information from a reliable source?
2. **Data format** - Does it follow our benefit criteria?
3. **Accuracy** - Are amounts and frequencies correct?
4. **Completeness** - Are all changes documented?

### 🚀 Quick Start for New Contributors

**First-time contributors can start with:**

1. **Annual fee updates** - These are straightforward and high-impact
2. **Obvious benefit amount changes** - Easy to verify
3. **Adding new major issuer cards** - If you see a popular card we're missing

**Example beginner contribution:**
"I noticed the Chase Sapphire Preferred annual fee increased to $120 on the Chase website, but your seed data shows $95."

### 💡 Tips for Success

- **Start small** - Update one card at a time
- **Document your sources** - Include links in PR description  
- **Double-check amounts** - Benefit values must be exact
- **Ask questions** - Use GitHub Issues if you're unsure
- **Be patient** - We review card updates carefully for accuracy

### 🎯 High-Impact Contribution Areas

We especially need help with:
- **American Express cards** - Complex benefit structures
- **Business credit cards** - Less community coverage
- **Regional bank cards** - Harder to track changes
- **Seasonal benefit changes** - Benefits that change by quarter

Thank you for helping keep our credit card data accurate and current! 🎉

## 📝 Coding Standards

### Code Style

We use ESLint and Prettier for code formatting. Before submitting:

```bash
# Check linting
npm run lint

# Run tests
npm test

# Build the project
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

## 🧪 Testing Guidelines

### Writing Tests

- Write tests for new features and bug fixes
- Use descriptive test names
- Test both happy path and edge cases
- Mock external dependencies appropriately

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### End-to-End (optional)

We are exploring adding Playwright-based smoke tests for auth, benefits dashboard, and cron side-effects. Contributions welcome.

### Test Structure

```typescript
// Example test structure
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

1. **Test your changes** thoroughly
2. **Update documentation** if needed
3. **Add tests** for new functionality
4. **Run the build** to ensure no errors
5. **Check for accessibility** compliance

### Commit Guidelines

Use clear, descriptive commit messages:

```bash
# Good examples
git commit -m "Fix: Correct annual fee calculation for multiple cards"
git commit -m "Feature: Add drag and drop benefit reordering"
git commit -m "Docs: Update setup instructions for new contributors"

# Use conventional commits format
type(scope): description

# Types: feat, fix, docs, style, refactor, test, chore
```

## 🐛 Issue Guidelines

### Reporting Bugs

When reporting bugs, please include:

- **Clear title** and description
- **Steps to reproduce** the issue
- **Expected vs actual behavior**
- **Screenshots** if applicable
- **Environment details** (OS, browser, Node version)
- **Error messages** if any

### Feature Requests

For feature requests, provide:

- **Clear use case** for the feature
- **Detailed description** of proposed functionality
- **Mockups or wireframes** if applicable
- **Consideration of alternatives**

## 🔄 Pull Request Process

### Before Creating a PR

1. **Sync with upstream** main branch
2. **Create a feature branch** from main
3. **Make your changes** in logical commits
4. **Test thoroughly**
5. **Update documentation**

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

### Community Support

- **GitHub Discussions** - General questions and discussions
- **Issues** - Bug reports and feature requests
- **Email** - Direct contact for sensitive issues

### Maintainer Response Time

We aim to respond to:
- **Critical bugs** - Within 24 hours
- **General issues** - Within 1 week
- **Pull requests** - Within 1 week

## 🎉 Recognition

Contributors are recognized in:
- **README.md acknowledgments**
- **Release notes** for significant contributions
- **GitHub contributors** page

Thank you for contributing to CouponCycle! 🚀 