#!/usr/bin/env node
/*
 Admin-only local tool to apply an exported patch plan to code/data.
 Current behavior: prints a TODO summary and safe suggestions for manual edits.
 In future, this can update prisma/seed.ts or a data source and open a PR.
*/

/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';

if (process.argv.length < 3) {
  console.error('Usage: node scripts/apply-catalog-patch-plan.cjs <plan.json|ndjson>');
  process.exit(1);
}

const planPath = path.resolve(process.argv[2]);
if (!fs.existsSync(planPath)) {
  console.error('File not found:', planPath);
  process.exit(1);
}

const ext = path.extname(planPath).toLowerCase();
let items = [];
if (ext === '.ndjson') {
  const raw = fs.readFileSync(planPath, 'utf8');
  items = raw.split('\n').filter(Boolean).map((l) => JSON.parse(l));
} else {
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  if (!plan || !Array.isArray(plan.items)) {
    console.error('Invalid plan JSON: missing items');
    process.exit(1);
  }
  items = plan.items;
}

const groups = items.reduce((acc, i) => {
  (acc[i.type] ||= []).push(i);
  return acc;
}, {});

console.log('Patch plan summary:');
for (const [type, arr] of Object.entries(groups)) {
  console.log(`- ${type}: ${arr.length}`);
}

console.log('\nProposed manual actions (non-destructive):');
for (const item of items) {
  switch (item.type) {
    case 'ADD_CARD':
      console.log(`* Add card: ${item.payloadJson.name} (${item.payloadJson.issuer}) [seed or data source]`);
      break;
    case 'EDIT_CARD':
      console.log(`* Edit card: ${item.payloadJson.match?.name} (${item.payloadJson.match?.issuer}) changes=${JSON.stringify(item.payloadJson.changes)}`);
      break;
    case 'ADD_BENEFIT':
      console.log(`* Add benefit to ${item.payloadJson.card?.issuer} / ${item.payloadJson.card?.name}: ${item.payloadJson.benefit?.description}`);
      break;
    case 'EDIT_BENEFIT':
      console.log(`* Edit benefit on ${item.payloadJson.card?.issuer} / ${item.payloadJson.card?.name}: match=${JSON.stringify(item.payloadJson.match)} changes=${JSON.stringify(item.payloadJson.changes)}`);
      break;
    case 'DEPRECATE_CARD':
      console.log(`* Deprecate card: ${item.payloadJson.card?.name} (${item.payloadJson.card?.issuer}) reason=${item.payloadJson.reason}`);
      break;
    case 'DEPRECATE_BENEFIT':
      console.log(`* Deprecate benefit on ${item.payloadJson.card?.issuer} / ${item.payloadJson.card?.name}: ${JSON.stringify(item.payloadJson.benefit)}`);
      break;
    case 'IMAGE_UPDATE':
      console.log(`* Update image for ${item.payloadJson.card?.issuer} / ${item.payloadJson.card?.name}: ${item.payloadJson.imageUrl}`);
      break;
    default:
      console.log(`* Unsupported type ${item.type}`);
  }
}

console.log('\nNote: This script currently generates a to-do summary. To auto-apply, extend this script to edit prisma/seed.ts and run prisma db seed in a dev environment, then open a PR.');

