#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, '..');
const scriptPath = path.join(dirname, 'update-card-benefits.ts');

const result = spawnSync(process.execPath, ['--import', 'tsx', scriptPath, ...process.argv.slice(2)], {
  cwd: repoRoot,
  stdio: 'inherit',
});

if (result.error) {
  console.error(`Failed to launch TypeScript runner: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
