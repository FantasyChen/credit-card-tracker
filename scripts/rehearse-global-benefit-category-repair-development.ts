#!/usr/bin/env tsx

import {
  GlobalBenefitCategoryRepairDevelopmentRehearsalError,
  runGlobalBenefitCategoryRepairDevelopmentRehearsal,
  serializeGlobalBenefitCategoryRepairDevelopmentRehearsalReport,
} from "../src/lib/global-benefit-category-repair-development-rehearsal";

interface DevelopmentRehearsalArguments {
  confirmation?: string;
  recoveryPointVerified: boolean;
}

export function parseDevelopmentCategoryRepairRehearsalArguments(
  args: readonly string[],
): DevelopmentRehearsalArguments {
  const allowedBoolean = "--recovery-point-verified";
  const confirmationPrefix = "--confirm=";
  if (args.some((argument) => argument !== allowedBoolean && !argument.startsWith(confirmationPrefix))
    || args.filter((argument) => argument === allowedBoolean).length !== 1
    || args.filter((argument) => argument.startsWith(confirmationPrefix)).length !== 1) {
    throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
  }
  const confirmation = args.find((argument) => argument.startsWith(confirmationPrefix))
    ?.slice(confirmationPrefix.length);
  if (!confirmation) throw new GlobalBenefitCategoryRepairDevelopmentRehearsalError();
  return { confirmation, recoveryPointVerified: true };
}

export async function main(): Promise<void> {
  try {
    const parsed = parseDevelopmentCategoryRepairRehearsalArguments(process.argv.slice(2));
    const report = await runGlobalBenefitCategoryRepairDevelopmentRehearsal({
      databaseUrlDev: process.env.DATABASE_URL_DEV,
      expectedDevelopmentHost: process.env.CATEGORY_REPAIR_REHEARSAL_EXPECTED_DEVELOPMENT_HOST,
      expectedDevelopmentIdentityFingerprint:
        process.env.CATEGORY_REPAIR_REHEARSAL_EXPECTED_DEVELOPMENT_IDENTITY_FINGERPRINT,
      expectedDevelopmentBranchFingerprint:
        process.env.CATEGORY_REPAIR_REHEARSAL_EXPECTED_DEVELOPMENT_BRANCH_FINGERPRINT,
      forbiddenProductionHost: process.env.CATEGORY_REPAIR_REHEARSAL_FORBIDDEN_PRODUCTION_HOST,
      forbiddenProductionBranchFingerprint:
        process.env.CATEGORY_REPAIR_REHEARSAL_FORBIDDEN_PRODUCTION_BRANCH_FINGERPRINT,
      rawAmexSyncMode: process.env.AMEX_SYNC_MODE,
      confirmation: parsed.confirmation,
      recoveryPointVerified: parsed.recoveryPointVerified,
    });
    process.stdout.write(`${serializeGlobalBenefitCategoryRepairDevelopmentRehearsalReport(report)}\n`);
  } catch (error) {
    if (error instanceof GlobalBenefitCategoryRepairDevelopmentRehearsalError
      && error.safeReport) {
      try {
        process.stdout.write(
          `${serializeGlobalBenefitCategoryRepairDevelopmentRehearsalReport(error.safeReport)}\n`,
        );
      } catch {
        // A malformed report is suppressed rather than leaking a secondary error.
      }
    }
    process.stderr.write("The development category-repair rehearsal failed safely.\n");
    process.exitCode = 1;
  }
}

const isDirectExecution = process.argv[1]
  ?.endsWith("rehearse-global-benefit-category-repair-development.ts") === true;
if (isDirectExecution) void main();
