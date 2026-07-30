import fs from "node:fs";
import path from "node:path";

const migrationPath = path.join(
  process.cwd(),
  "prisma/migrations/20260729000000_add_global_catalog_foundation/migration.sql",
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
