import fs from "node:fs";
import path from "node:path";

const migrationPath = path.join(
  process.cwd(),
  "prisma/migrations/20260729000000_add_global_catalog_foundation/migration.sql",
);
const categoryRepairMigrationPath = path.join(
  process.cwd(),
  "prisma/migrations/20260801000000_add_global_benefit_category_repair/migration.sql",
);

describe("global catalog foundation migration SQL", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");

  it("is additive and leaves existing status state untouched", () => {
    expect(sql).toContain('ADD COLUMN "catalogKey" TEXT');
    expect(sql).toContain('ALTER COLUMN "benefitId" DROP NOT NULL');
    expect(sql).not.toMatch(/DROP\s+(?:TABLE|COLUMN|TYPE)\b/i);
    expect(sql).not.toMatch(/TRUNCATE\b/i);
    expect(sql).not.toMatch(/DELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/UPDATE\s+"BenefitStatus"\b/i);
  });

  it("uses restrictive global references and source-specific occurrence identity", () => {
    expect(sql).toContain('ON DELETE RESTRICT ON UPDATE CASCADE');
    expect(sql).toContain('CREATE UNIQUE INDEX "BenefitStatus_custom_occurrence_partial_key"');
    expect(sql).toContain('WHERE "benefitId" IS NOT NULL');
    expect(sql).toContain('CREATE UNIQUE INDEX "BenefitStatus_standard_occurrence_key"');
    expect(sql).toContain('WHERE "creditCardId" IS NOT NULL AND "predefinedBenefitId" IS NOT NULL');
    expect(sql).not.toMatch(/REFERENCES\s+"Predefined(?:Card|Benefit)"\("id"\)\s+ON DELETE CASCADE/i);
  });

  it("adds retirement, ledger, and canonical AMEX audit metadata", () => {
    expect(sql).toContain('ADD COLUMN "retiredAt" TIMESTAMP(3)');
    expect(sql).toContain('CREATE TABLE "CatalogMigrationLedger"');
    expect(sql).toContain('"legacyBenefitId" TEXT NOT NULL');
    expect(sql).toContain('"destinationPredefinedBenefitId" TEXT');
    expect(sql).toContain('"destinationDefinitionFingerprint" TEXT');
  });
});

describe("global benefit category repair migration SQL", () => {
  const sql = fs.readFileSync(categoryRepairMigrationPath, "utf8");

  it("is purely additive and performs no existing-data rewrite", () => {
    expect(sql).toContain('CREATE TABLE "GlobalBenefitCategoryRepair"');
    expect(sql).toContain('CREATE TABLE "GlobalBenefitCategoryRepairOccurrence"');
    expect(sql).not.toMatch(/ALTER\s+TABLE\s+"(?:Benefit|BenefitStatus|CatalogMigrationLedger)"/i);
    expect(sql).not.toMatch(/DROP\s+(?:TABLE|COLUMN|TYPE)\b/i);
    expect(sql).not.toMatch(/TRUNCATE\b/i);
    expect(sql).not.toMatch(/DELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/UPDATE\s+"(?:Benefit|BenefitStatus|CatalogMigrationLedger)"\b/i);
    expect(sql).not.toMatch(/INSERT\s+INTO\s+"(?:Benefit|BenefitStatus|CatalogMigrationLedger)"\b/i);
  });

  it("cascades owned evidence while keeping global targets restrictive", () => {
    expect(sql).toContain('CREATE UNIQUE INDEX "GlobalBenefitCategoryRepair_legacyBenefitId_key"');
    expect(sql).toContain('CREATE UNIQUE INDEX "GBCategoryRepair_ledgerId_key"');
    for (const relation of [
      /ADD CONSTRAINT "GBCategoryRepair_legacyBenefit_fkey"\s+FOREIGN KEY \("legacyBenefitId"\) REFERENCES "Benefit"\("id"\)\s+ON DELETE CASCADE/,
      /ADD CONSTRAINT "GBCategoryRepair_ledger_fkey"\s+FOREIGN KEY \("catalogMigrationLedgerId"\) REFERENCES "CatalogMigrationLedger"\("id"\)\s+ON DELETE CASCADE/,
      /ADD CONSTRAINT "GBCategoryRepair_user_fkey"\s+FOREIGN KEY \("userId"\) REFERENCES "User"\("id"\)\s+ON DELETE CASCADE/,
      /ADD CONSTRAINT "GBCategoryRepair_card_fkey"\s+FOREIGN KEY \("creditCardId"\) REFERENCES "CreditCard"\("id"\)\s+ON DELETE CASCADE/,
      /ADD CONSTRAINT "GBCategoryRepairOccurrence_repair_fkey"\s+FOREIGN KEY \("repairId"\) REFERENCES "GlobalBenefitCategoryRepair"\("id"\)\s+ON DELETE CASCADE/,
      /ADD CONSTRAINT "GBCategoryRepairOccurrence_user_fkey"\s+FOREIGN KEY \("userId"\) REFERENCES "User"\("id"\)\s+ON DELETE CASCADE/,
      /ADD CONSTRAINT "GBCategoryRepairOccurrence_card_fkey"\s+FOREIGN KEY \("creditCardId"\) REFERENCES "CreditCard"\("id"\)\s+ON DELETE CASCADE/,
      /ADD CONSTRAINT "GBCategoryRepairOccurrence_keeperStatus_fkey"\s+FOREIGN KEY \("keeperStatusId"\) REFERENCES "BenefitStatus"\("id"\)\s+ON DELETE CASCADE/,
    ]) {
      expect(sql).toMatch(relation);
    }
    expect(sql).toMatch(
      /FOREIGN KEY \("predefinedCardId"\) REFERENCES "PredefinedCard"\("id"\)\s+ON DELETE RESTRICT/,
    );
    expect(sql.match(/REFERENCES "PredefinedBenefit"\("id"\)\s+ON DELETE RESTRICT/g)).toHaveLength(2);
    expect(sql).not.toMatch(/REFERENCES "Predefined(?:Card|Benefit)"\("id"\)\s+ON DELETE CASCADE/);
  });

  it("stores catalog-bound fingerprints and versioned rollback evidence", () => {
    for (const column of [
      "targetPredefinedCardCatalogKey",
      "targetPredefinedBenefitCatalogKey",
      "definitionFingerprint",
      "inventoryFingerprint",
      "graphFingerprint",
      "reviewedCurrentGraphFingerprint",
      "destinationFingerprint",
      "manifestFingerprint",
      "manifestEntryFingerprint",
      "planFingerprint",
      "postimageFingerprint",
    ]) {
      expect(sql).toContain(`"${column}" TEXT NOT NULL`);
    }
    expect(sql).toContain('"keeperBaselineVersion" INTEGER NOT NULL DEFAULT 1');
    expect(sql).toContain('"keeperBaseline" JSONB NOT NULL');
    expect(sql).toContain('"removedStatusId" TEXT');
    expect(sql).toContain('"removedStatusPreimageVersion" INTEGER');
    expect(sql).toContain('"removedStatusPreimage" JSONB');
    expect(sql).toContain('"repairAddedAuditMetadata" JSONB NOT NULL');
    expect(sql).toContain('CONSTRAINT "GBCategoryRepairOccurrence_removed_snapshot_check"');
  });

  it("binds exact occurrence tuples and closed phase/action/source values", () => {
    expect(sql).toContain("CREATE TYPE \"GlobalBenefitCategoryRepairPhase\" AS ENUM ('APPLIED', 'ROLLED_BACK')");
    expect(sql).toContain(
      "CREATE TYPE \"GlobalBenefitCategoryRepairAction\" AS ENUM ('PROMOTE_LEGACY_STATUS', 'RETAIN_CANONICAL_STATUS')",
    );
    expect(sql).toContain(
      "CREATE TYPE \"GlobalBenefitCategoryRepairStatusSource\" AS ENUM ('LEGACY_CUSTOM', 'CANONICAL_STANDARD')",
    );
    expect(sql).toContain('CREATE UNIQUE INDEX "GBCategoryRepairOccurrence_tuple_key"');
    for (const column of [
      "repairId",
      "userId",
      "creditCardId",
      "predefinedBenefitId",
      "cycleStartDate",
      "cycleEndDate",
      "occurrenceIndex",
    ]) {
      expect(sql).toContain(`"${column}"`);
    }
    expect(sql).toContain('CONSTRAINT "GBCategoryRepairOccurrence_action_source_check"');
    expect(sql).toContain('CONSTRAINT "GBCategoryRepairOccurrence_removed_source_check"');
  });
});
