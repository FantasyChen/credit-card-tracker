#!/usr/bin/env node

const fs = require('fs');

const publicSurfaceFiles = [
  'src/app/page.tsx',
  'src/app/cards/browse/page.tsx',
  'src/app/cards/browse/[name]/page.tsx',
  'src/components/SupportedCreditCards.tsx',
];

const publicApiFiles = [
  'src/app/api/predefined-cards/route.ts',
  'src/app/api/predefined-cards-with-benefits/route.ts',
  'src/app/api/search/route.ts',
];

const failures = [];

function assertFile(path) {
  if (!fs.existsSync(path)) {
    failures.push(`${path}: file is missing`);
    return '';
  }
  return fs.readFileSync(path, 'utf8');
}

for (const path of publicSurfaceFiles) {
  const source = assertFile(path);
  if (source.includes('@/lib/prisma') || source.includes("from '@/lib/auth'") || source.includes('from "next-auth"')) {
    failures.push(`${path}: anonymous public surface must not import Prisma/auth directly`);
  }
  if (/fetch\(\s*['"`]\/api\/(?:predefined-cards|search)/.test(source)) {
    failures.push(`${path}: anonymous public surface must not fetch DB-backed catalog/search APIs`);
  }
}

for (const path of publicApiFiles) {
  const source = assertFile(path);
  if (/^import .*['"]@\/lib\/prisma['"];?/m.test(source) || /^import .*['"]@\/lib\/auth['"];?/m.test(source)) {
    failures.push(`${path}: public API must not load Prisma/auth at module scope`);
  }
}

const packageJson = JSON.parse(assertFile('package.json'));
if (packageJson.scripts?.build?.includes('prisma db seed')) {
  failures.push('package.json: build script must not run prisma db seed');
}

if (failures.length > 0) {
  console.error('Public DB invariant failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Public DB invariant passed.');
