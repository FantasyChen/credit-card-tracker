#!/usr/bin/env node

const { spawnSync } = require('child_process');

const unreachableDatabaseUrl = 'postgresql://invalid:invalid@127.0.0.1:1/perks_reminder_unreachable';

const result = spawnSync('npx', ['next', 'build'], {
  env: {
    ...process.env,
    DATABASE_URL: unreachableDatabaseUrl,
    DIRECT_URL: unreachableDatabaseUrl,
    NEXT_TELEMETRY_DISABLED: '1',
  },
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
