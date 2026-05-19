import { NextRequest } from 'next/server';
import { middleware } from '../middleware';

function requestFor(url: string): NextRequest {
  return new NextRequest(url, {
    headers: {
      host: new URL(url).host,
    },
  });
}

describe('middleware', () => {
  it('redirects loyalty auth pages to the canonical www auth host', () => {
    const response = middleware(
      requestFor('https://loyalty.perks-reminder.com/auth/signin')
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://www.perks-reminder.com/auth/signin?callbackUrl=https%3A%2F%2Floyalty.perks-reminder.com%2Floyalty'
    );
  });

  it('preserves an explicit loyalty callback URL on auth redirects', () => {
    const response = middleware(
      requestFor(
        'https://loyalty.perks-reminder.com/auth/signin?callbackUrl=https%3A%2F%2Floyalty.perks-reminder.com%2Floyalty'
      )
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://www.perks-reminder.com/auth/signin?callbackUrl=https%3A%2F%2Floyalty.perks-reminder.com%2Floyalty'
    );
  });

  it('keeps local loyalty auth redirects on localhost', () => {
    const response = middleware(
      requestFor('http://loyalty.localhost:3000/auth/signin')
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/auth/signin?callbackUrl=http%3A%2F%2Floyalty.localhost%3A3000%2Floyalty'
    );
  });
});
