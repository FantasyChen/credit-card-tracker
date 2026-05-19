import { getCanonicalAuthUrl } from '../site';

describe('site helpers', () => {
  it('canonicalizes apex production auth URLs to www', () => {
    expect(getCanonicalAuthUrl('https://perks-reminder.com')).toBe(
      'https://www.perks-reminder.com'
    );
    expect(getCanonicalAuthUrl('https://perks-reminder.com/')).toBe(
      'https://www.perks-reminder.com'
    );
  });

  it('keeps canonical and local auth URLs unchanged', () => {
    expect(getCanonicalAuthUrl('https://www.perks-reminder.com')).toBe(
      'https://www.perks-reminder.com'
    );
    expect(getCanonicalAuthUrl('http://localhost:3000')).toBe(
      'http://localhost:3000'
    );
  });
});
