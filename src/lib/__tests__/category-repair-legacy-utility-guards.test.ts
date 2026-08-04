import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

function source(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8');
}

function expectOrdered(text: string, guard: string, write: string): void {
  const guardIndex = text.indexOf(guard);
  const writeIndex = text.indexOf(write);
  expect(guardIndex).toBeGreaterThanOrEqual(0);
  expect(writeIndex).toBeGreaterThan(guardIndex);
}

describe('superseded category-repair utility guards', () => {
  it('blocks the broad migration engine before template and per-card writes', () => {
    const text = source('src/lib/benefit-migration/migration-engine.ts');
    expectOrdered(text, 'FROM "GlobalBenefitCategoryRepair" repair', 'await this.updatePredefinedCards');
    expectOrdered(text, 'SELECT 1 FROM "GlobalBenefitCategoryRepair"', 'await tx.benefitStatus.deleteMany');
    expect(text).toContain("repair.\"phase\" = 'APPLIED'");
    expect(text).toContain('JOIN "PredefinedCard" target ON target."id" = repair."predefinedCardId"');
    expect(text).toContain('target."name" = ${cardUpdate.cardName}');
    expect(text).toContain("\"phase\" = 'APPLIED'");
  });

  it('blocks the unified card updater before card mutations and status batches', () => {
    const text = source('scripts/update-card-benefits.ts');
    expectOrdered(text, 'const activeRepairs = await tx.$queryRaw', 'await tx.benefit.create');
    expectOrdered(text, 'const repairRows = await prisma.$queryRaw', 'await prisma.benefitStatus.createMany');
    expect(text.match(/"phase" = 'APPLIED'/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('blocks the narrow duplicate repair before creates or deletes', () => {
    const text = source('scripts/fix-duplicate-active-benefit-statuses.ts');
    expectOrdered(text, 'const intersections = await tx.$queryRaw', 'await tx.benefitStatus.upsert');
    expectOrdered(text, 'const intersections = await tx.$queryRaw', 'await tx.benefitStatus.deleteMany');
    expect(text).toContain("repair.\"phase\" = 'APPLIED'");
    expect(text).toContain('evidence."keeperStatusId"');
    expect(text).toContain('evidence."occurrenceIndex"');
  });

  it('blocks the broad duplicate repair before its first force write', () => {
    const text = source('scripts/fix-duplicate-benefit-statuses.cjs');
    expectOrdered(text, 'const intersections = await prisma.$queryRaw', 'await prisma.benefitStatus.deleteMany');
    expectOrdered(text, 'const intersections = await prisma.$queryRaw', 'await prisma.benefitStatus.update');
    expect(text).toContain("repair.\"phase\" = 'APPLIED'");
    expect(text).toContain('evidence."keeperStatusId"');
    expect(text).toContain('evidence."occurrenceIndex"');
  });

  it('persists absent clone rollback preimages as SQL NULL rather than JSON null', () => {
    const text = source('src/lib/amex-sync/prisma-single-user-clone.ts');
    expect(text).toContain('row.removedStatusPreimage === null');
    expect(text).toContain('row.removedStatusSource === null');
    expect(text.match(/Prisma\.sql`NULL`/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});
