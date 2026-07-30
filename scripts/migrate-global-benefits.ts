#!/usr/bin/env tsx

import { prisma } from "../src/lib/prisma";
import {
  GlobalBenefitMigrationError,
  runGlobalBenefitMigrationOperator,
  type GlobalBenefitMigrationMode,
} from "../src/lib/global-benefit-migration";
import { PrismaGlobalBenefitMigrationDatabase } from "../src/lib/prisma-global-benefit-migration";

function option(args: string[], name: string): string | undefined {
  return args.find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1);
}

function parseMode(args: string[]): GlobalBenefitMigrationMode {
  const selected = [
    args.includes("--dry-run") ? "dry-run" : null,
    args.includes("--apply") ? "apply" : null,
    args.includes("--cleanup") ? "cleanup" : null,
    args.includes("--rollback") ? "rollback" : null,
  ].filter((mode): mode is GlobalBenefitMigrationMode => mode !== null);
  if (selected.length > 1) throw new Error("Choose exactly one migration mode.");
  return selected[0] ?? "dry-run";
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const allowedFlags = new Set([
    "--dry-run", "--apply", "--cleanup", "--rollback", "--target-verified",
    "--parity-verified", "--recovery-point-verified",
  ]);
  const unknown = args.find((argument) => !allowedFlags.has(argument)
    && !["--limit=", "--after=", "--confirm=", "--expect-fingerprint="].some((prefix) => argument.startsWith(prefix)));
  if (unknown) throw new Error("An unsupported migration argument was provided.");
  const limitValue = option(args, "--limit");
  const limit = limitValue === undefined ? undefined : Number(limitValue);
  const report = await runGlobalBenefitMigrationOperator({
    mode: parseMode(args),
    limit,
    after: option(args, "--after"),
    confirmation: option(args, "--confirm"),
    expectedSourceFingerprint: option(args, "--expect-fingerprint"),
    targetVerified: args.includes("--target-verified"),
    parityVerified: args.includes("--parity-verified"),
    recoveryPointVerified: args.includes("--recovery-point-verified"),
    database: new PrismaGlobalBenefitMigrationDatabase(prisma),
  });
  console.log(JSON.stringify(report, null, 2));
  if (report.hasMore) {
    console.warn("The bounded migration has more units. Review this aggregate report before continuing.");
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof GlobalBenefitMigrationError
      ? error.message
      : "The global-benefit migration failed safely.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
