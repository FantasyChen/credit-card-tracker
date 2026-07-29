#!/usr/bin/env tsx

import { prisma } from "../src/lib/prisma";
import {
  AMEX_CATALOG_BACKFILL_APPLY_CONFIRMATION,
  runAmexCatalogBackfillOperator,
} from "../src/lib/amex-sync/catalog-backfill-operator";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const dryRun = args.includes("--dry-run");
  if (apply && dryRun) throw new Error("Choose either --dry-run or --apply, not both.");
  const confirmApply = args.find((argument) => argument.startsWith("--confirm="))?.slice("--confirm=".length);
  const limitValue = args.find((argument) => argument.startsWith("--limit="))?.slice("--limit=".length);
  const limit = limitValue === undefined ? undefined : Number(limitValue);
  const afterPredefined = args.find((argument) => argument.startsWith("--after-predefined="))?.slice("--after-predefined=".length);
  const afterUser = args.find((argument) => argument.startsWith("--after-user="))?.slice("--after-user=".length);

  if (apply && confirmApply !== AMEX_CATALOG_BACKFILL_APPLY_CONFIRMATION) {
    throw new Error(`Apply requires --confirm=${AMEX_CATALOG_BACKFILL_APPLY_CONFIRMATION}.`);
  }
  if (apply && !args.includes("--target-verified")) {
    throw new Error("Apply requires --target-verified after separately verifying the intended database target.");
  }

  const report = await runAmexCatalogBackfillOperator({
    mode: apply ? "apply" : "dry-run",
    confirmApply,
    targetVerified: args.includes("--target-verified"),
    limit,
    after: { predefined: afterPredefined, user: afterUser },
  });
  console.log(JSON.stringify(report, null, 2));
  if (report.hasMore.predefined || report.hasMore.user) {
    console.warn("The bounded run has more matching records. Review this report before running another batch.");
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
