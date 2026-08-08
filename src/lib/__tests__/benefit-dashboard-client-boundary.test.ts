import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

function source(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8');
}

describe('benefit dashboard client boundary', () => {
  it('keeps interactive dashboard components on the client-safe module', () => {
    const clientComponents = [
      'src/components/BenefitsDisplayClient.tsx',
      'src/components/CategoryBenefitsGroup.tsx',
      'src/components/BenefitCardClient.tsx',
    ];

    for (const path of clientComponents) {
      const text = source(path);
      expect(text).toContain('@/lib/benefit-dashboard-client');
      expect(text).not.toMatch(/from\s+['"]@\/lib\/benefit-dashboard['"]/);
      expect(text).not.toContain('@/lib/effective-benefit');
    }
  });

  it('does not add a runtime effective-benefit dependency to the client-safe module', () => {
    const text = source('src/lib/benefit-dashboard-client.ts');
    expect(text).not.toMatch(
      /^\s*import\s+(?!type\b)[\s\S]*?from\s+['"]@\/lib\/effective-benefit['"]/m
    );
  });
});
