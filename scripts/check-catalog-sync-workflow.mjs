#!/usr/bin/env node

import fs from "node:fs";

const workflow = fs.readFileSync(".github/workflows/global-catalog-sync.yml", "utf8");
const targetVerifier = fs.readFileSync("scripts/verify-catalog-sync-target.ts", "utf8");
const requiredFragments = [
  "push:",
  "branches:",
  "- main",
  "src/lib/static-catalog.ts",
  "src/lib/catalog/**",
  "scripts/sync-global-catalog.ts",
  "package-lock.json",
  "environment: catalog-sync-preview",
  "environment: catalog-sync-production",
  "CATALOG_SYNC_DATABASE_URL",
  "CATALOG_SYNC_EXPECTED_FINGERPRINT",
  "scripts/verify-catalog-sync-target.ts",
  "--dry-run",
  "--apply",
  "--target-verified",
  "--confirm=SYNC_GLOBAL_CATALOG",
  "needs: dry-run",
  "if: github.ref == 'refs/heads/main'",
  "Record aggregate dry-run result",
  "2>catalog-sync-error.log",
  "stop without compensating writes",
  "npm run --silent sync:global-catalog",
];
for (const fragment of requiredFragments) {
  if (!workflow.includes(fragment)) throw new Error(`Catalog sync workflow is missing: ${fragment}`);
}
const forbiddenFragments = ["prisma db seed", "prisma migrate", "prisma db push", "--force-reset", "DATABASE_URL_DEV"];
for (const fragment of forbiddenFragments) {
  if (workflow.includes(fragment)) throw new Error(`Catalog sync workflow contains forbidden operation: ${fragment}`);
}
for (const fragment of ["!row.branch_id", "current_setting('neon.branch_id'", "new PrismaClient({ datasourceUrl: databaseUrl })"]) {
  if (!targetVerifier.includes(fragment)) throw new Error(`Catalog sync target verifier is missing: ${fragment}`);
}
if (targetVerifier.includes("branch-unavailable")) {
  throw new Error("Catalog sync target verifier must reject missing branch identity.");
}
console.log("Catalog sync workflow structure passed.");
