#!/usr/bin/env node

const dotenv = require('dotenv');
const { execFileSync } = require('child_process');

dotenv.config();

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

function mask(url) {
  return url ? url.replace(/\/\/[^@]+@/, '//****@') : '(not set)';
}

function directUrlFor(url, explicitDirectUrl) {
  if (explicitDirectUrl) return explicitDirectUrl;
  return url?.replace('-pooler.', '.');
}

function checkMigrationStatus(url, label, directUrl) {
  try {
    const output = execFileSync('npx', ['prisma', 'migrate', 'status'], {
      env: { ...process.env, DATABASE_URL: url, DIRECT_URL: directUrl },
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (output.includes('Database schema is up to date')) {
      console.log(`  ${colors.green}✅ Schema is up to date${colors.reset}`);
      return true;
    }
    const pending = output.match(/Following migration.*not yet been applied:\n([\s\S]*?)\n\nTo apply/);
    if (pending) {
      console.log(`  ${colors.yellow}⚠️  Pending migrations:${colors.reset}`);
      pending[1].trim().split('\n').forEach(line => {
        console.log(`     ${line.trim()}`);
      });
      return false;
    }
    console.log(`  ${colors.yellow}⚠️  Unknown status${colors.reset}`);
    return false;
  } catch (err) {
    const stderr = err.stderr || '';
    if (stderr.includes('P1001') || stderr.includes("Can't reach database")) {
      console.log(`  ${colors.red}❌ Unreachable${colors.reset} — branch may be suspended or deleted`);
    } else {
      console.log(`  ${colors.red}❌ Error checking status${colors.reset}`);
    }
    return false;
  }
}

console.log(`${colors.bold}${colors.blue}🔍 Database Connection Check${colors.reset}\n`);

const prodUrl = process.env.DATABASE_URL;
const prodDirectUrl = directUrlFor(prodUrl, process.env.DIRECT_URL);
const devUrl = process.env.DATABASE_URL_DEV;
const devDirectUrl = directUrlFor(devUrl);

// --- Production ---
console.log(`${colors.bold}📦 Production Database${colors.reset}`);
if (prodUrl) {
  console.log(`  URL: ${mask(prodUrl)}`);
  checkMigrationStatus(prodUrl, 'Production', prodDirectUrl);
} else {
  console.log(`  ${colors.red}❌ DATABASE_URL not set${colors.reset}`);
}

console.log('');

// --- Development ---
console.log(`${colors.bold}🧪 Development Database${colors.reset}`);
if (devUrl) {
  console.log(`  URL: ${mask(devUrl)}`);
  const devOk = checkMigrationStatus(devUrl, 'Development', devDirectUrl);
  if (!devOk) {
    console.log(`  ${colors.dim}💡 Run: npm run db:dev:migrate${colors.reset}`);
  }
} else {
  console.log(`  ${colors.yellow}⚠️  DATABASE_URL_DEV not set${colors.reset}`);
  console.log(`  ${colors.dim}💡 Add DATABASE_URL_DEV to .env (Neon dev branch)${colors.reset}`);
}

console.log('');

// --- Active connection ---
const activeUrl = process.env.DATABASE_URL;
if (activeUrl && devUrl && activeUrl === devUrl) {
  console.log(`${colors.green}🔒 Active target: DEVELOPMENT (safe for testing)${colors.reset}`);
} else if (activeUrl) {
  console.log(`${colors.yellow}🔒 Active target: PRODUCTION${colors.reset}`);
  console.log(`   ${colors.dim}Local commands (dev server, Prisma CLI) use this by default.${colors.reset}`);
  console.log(`   ${colors.dim}Use "npm run dev:devdb" to run dev server against the dev database.${colors.reset}`);
}

console.log('');
console.log(`${colors.bold}Available Commands:${colors.reset}`);
console.log(`  npm run db:check          — this check`);
console.log(`  npm run db:dev:status     — dev DB migration status`);
console.log(`  npm run db:dev:migrate    — apply migrations to dev DB`);
console.log(`  npm run db:dev:seed       — seed dev DB`);
console.log(`  npm run db:dev:reset      — reset dev DB (safe, dev only)`);
console.log(`  npm run db:prod:status    — prod DB migration status`);
console.log(`  npm run dev:devdb         — run dev server against dev DB`);
