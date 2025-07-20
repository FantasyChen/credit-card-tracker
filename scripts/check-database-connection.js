#!/usr/bin/env node

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Colors for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const log = {
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  step: (msg) => console.log(`${colors.bold}${colors.blue}🔄 ${msg}${colors.reset}`)
};

console.log(`${colors.bold}${colors.blue}🔍 Database Connection Check${colors.reset}\n`);

const currentUrl = process.env.DATABASE_URL;
const devUrl = process.env.DATABASE_URL_DEV;

// Check current connection
if (!currentUrl && !devUrl) {
  log.error('Neither DATABASE_URL nor DATABASE_URL_DEV is set');
  process.exit(1);
}

console.log('📋 Current Configuration:');
if (currentUrl) {
  console.log(`DATABASE_URL: ${currentUrl.replace(/:[^:@]+@/, ':****@')}`);
} else {
  console.log('DATABASE_URL: Not set (good for development safety!)');
}

if (devUrl) {
  console.log(`DATABASE_URL_DEV: ${devUrl.replace(/:[^:@]+@/, ':****@')}`);
} else {
  log.warning('DATABASE_URL_DEV is not configured');
}

console.log('');

// Determine which branch we're connected to
if (!currentUrl && devUrl) {
  log.info('DATABASE_URL not set - development mode');
  console.log('✅ This is actually safer for development!');
  console.log('💡 To use development branch:');
  console.log(`  export DATABASE_URL=$DATABASE_URL_DEV`);
  console.log('');
  console.log('🔄 Development workflow:');
  console.log(`  export DATABASE_URL=$DATABASE_URL_DEV`);
  console.log('  npx prisma migrate dev --name your_migration');
  console.log('  npm run dev');
  console.log('  npm test');
} else if (devUrl && currentUrl === devUrl) {
  log.success('Connected to DEVELOPMENT branch');
  console.log('✅ Safe to run migrations and tests');
  console.log('✅ Safe to use: npx prisma migrate reset');
  console.log('');
  console.log('🔄 Development workflow:');
  console.log('  npx prisma migrate dev --name your_migration');
  console.log('  npm run dev');
  console.log('  npm test');
} else if (currentUrl && currentUrl.includes('neon.tech')) {
  log.warning('Connected to PRODUCTION or unknown Neon database');
  console.log('🚨 DO NOT run migrations directly on this database');
  console.log('');
  if (devUrl) {
    console.log('💡 Switch to development branch:');
    console.log(`  export DATABASE_URL=$DATABASE_URL_DEV`);
  } else {
    console.log('💡 Set up development branch:');
    console.log('1. Create a development branch in Neon Console');
    console.log('2. Add DATABASE_URL_DEV to your .env file');
    console.log('3. Use: export DATABASE_URL=$DATABASE_URL_DEV');
  }
} else if (currentUrl) {
  log.info('Connected to local or other database');
  console.log('🔍 Verify this is your intended development environment');
}

console.log('');
console.log('📖 Complete migration guide: docs/safe-migration-guide.md'); 