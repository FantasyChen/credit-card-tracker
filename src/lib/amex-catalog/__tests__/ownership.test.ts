import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

function source(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8');
}

function importSpecifiers(text: string): string[] {
  return Array.from(text.matchAll(/(?:from\s+|import\s*\()\s*['"]([^'"]+)['"]/g), (match) => match[1]);
}

describe('neutral AMEX catalog ownership', () => {
  it('keeps public Catalog modules independent from amex-sync implementation', () => {
    expect(source('src/lib/static-catalog.ts')).not.toContain('amex-sync');
    expect(source('src/lib/american-express-card-catalog.ts')).not.toContain('amex-sync');
    expect(source('src/lib/catalog/validation.ts')).not.toContain('amex-sync');
  });

  it('keeps browser reader modules independent from amex-sync implementation', () => {
    const directory = join(ROOT, 'src/lib/amex-benefit-reader');
    const readerImports = readdirSync(directory)
      .filter((name) => name.endsWith('.ts'))
      .flatMap((name) => importSpecifiers(readFileSync(join(directory, name), 'utf8')));

    expect(readerImports.some((specifier) => specifier.includes('/amex-sync/'))).toBe(false);
  });

  it('keeps the neutral module free of reader and sync ownership imports', () => {
    const directory = join(ROOT, 'src/lib/amex-catalog');
    const neutralImports = readdirSync(directory)
      .filter((name) => name.endsWith('.ts'))
      .flatMap((name) => importSpecifiers(readFileSync(join(directory, name), 'utf8')));

    expect(neutralImports.some((specifier) => specifier.includes('amex-benefit-reader'))).toBe(false);
    expect(neutralImports.some((specifier) => specifier.includes('amex-sync'))).toBe(false);
  });
});
