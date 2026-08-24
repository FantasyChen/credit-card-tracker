import { existsSync, readFileSync } from 'node:fs';
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
  it('keeps superseded broad migration utilities absent', () => {
    expect(existsSync(join(ROOT, 'src/lib/benefit-migration/migration-engine.ts'))).toBe(false);
    expect(existsSync(join(ROOT, 'src/lib/benefit-migration/migration-cli.ts'))).toBe(false);
    expect(existsSync(join(ROOT, 'scripts/update-card-benefits.ts'))).toBe(false);
    expect(existsSync(join(ROOT, 'scripts/update-card-benefits.js'))).toBe(false);
    expect(existsSync(join(ROOT, 'scripts/migrate-benefits.js'))).toBe(false);
    expect(existsSync(join(ROOT, 'scripts/validate-migration.js'))).toBe(false);
    expect(existsSync(join(ROOT, 'scripts/fix-duplicate-benefit-statuses.cjs'))).toBe(false);
  });

  it('blocks the narrow duplicate repair before creates or deletes', () => {
    const text = source('scripts/fix-duplicate-active-benefit-statuses.ts');
    expectOrdered(text, 'const intersections = await tx.$queryRaw', 'await tx.benefitStatus.upsert');
    expectOrdered(text, 'const intersections = await tx.$queryRaw', 'await tx.benefitStatus.deleteMany');
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
