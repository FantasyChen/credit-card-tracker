# Contributing to CouponCycle

First off, thank you for considering contributing to CouponCycle! 🎉

CouponCycle is a community-driven project, and we welcome contributions from developers of all skill levels. Whether you're fixing bugs, adding features, improving documentation, or helping with testing, your contribution is valuable.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Submitting Changes](#submitting-changes)
- [Issue Guidelines](#issue-guidelines)
- [Pull Request Process](#pull-request-process)

## 🤝 Code of Conduct

This project follows standard open source community guidelines. Please be respectful, inclusive, and constructive in all interactions. Report any unacceptable behavior to the project maintainers.

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

### Key Technologies

- **Next.js 15** - React framework with App Router
- **Prisma** - Database ORM
- **NextAuth.js** - Authentication
- **Tailwind CSS** - Styling
- **TypeScript** - Type safety
- **Jest** - Testing framework

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