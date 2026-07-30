#!/usr/bin/env tsx

import { prisma } from "../src/lib/prisma";
import {
  GLOBAL_CATALOG_SYNC_CONFIRMATION,
  runGlobalCatalogSyncOperator,
  type CatalogPrismaClient,
} from "../src/lib/catalog/prisma-synchronizer";
import { predefinedCardsData } from "../src/lib/static-catalog";

export async function main(args = process.argv.slice(2)): Promise<void> {
  const apply = args.includes("--apply");
  const dryRun = args.includes("--dry-run");
  if (apply && dryRun) throw new Error("Choose either --dry-run or --apply, not both.");
  const confirmApply = args.find((argument) => argument.startsWith("--confirm="))?.slice("--confirm=".length);

  const report = await runGlobalCatalogSyncOperator({
    source: predefinedCardsData,
    database: prisma as unknown as CatalogPrismaClient,
    mode: apply ? "apply" : "dry-run",
    targetVerified: args.includes("--target-verified"),
    confirmApply,
  });
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(`Apply requires --target-verified --confirm=${GLOBAL_CATALOG_SYNC_CONFIRMATION}.`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
