#!/usr/bin/env node

/**
 * Runs a command with DATABASE_URL set to DATABASE_URL_DEV from .env.
 * Usage: node scripts/with-dev-db.js <command> [args...]
 * Example: node scripts/with-dev-db.js npx prisma migrate status
 */

import dotenv from 'dotenv';
import { spawn } from 'child_process';

dotenv.config();

const devUrl = process.env.DATABASE_URL_DEV;

if (!devUrl) {
  console.error('\x1b[31m❌ DATABASE_URL_DEV is not set in .env\x1b[0m');
  console.error('   Add it to your .env file pointing to your Neon dev branch.');
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/with-dev-db.js <command> [args...]');
  process.exit(1);
}

const maskedUrl = devUrl.replace(/\/\/[^@]+@/, '//****@');
console.log(`\x1b[34m🔧 Using DEV database: ${maskedUrl}\x1b[0m\n`);

const child = spawn(args[0], args.slice(1), {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: devUrl },
  shell: true,
});

child.on('close', (code) => {
  process.exit(code ?? 0);
});
