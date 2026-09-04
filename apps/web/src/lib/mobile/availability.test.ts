import { afterEach, describe, expect, it, vi } from 'vitest';
import { mobileApiIsEnabled } from './availability';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('mobileApiIsEnabled', () => {
  it('allows an explicitly configured production mobile API', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('MOBILE_API_ENABLED', 'true');
    vi.stubEnv('MOBILE_AUTH_SECRET', 'a'.repeat(32));

    expect(mobileApiIsEnabled()).toBe(true);
  });

  it('requires the mobile feature flag', () => {
    vi.stubEnv('MOBILE_API_ENABLED', 'false');
    vi.stubEnv('MOBILE_AUTH_SECRET', 'a'.repeat(32));

    expect(mobileApiIsEnabled()).toBe(false);
  });

  it('requires a dedicated mobile secret rather than the web auth secret', () => {
    vi.stubEnv('MOBILE_API_ENABLED', 'true');
    vi.stubEnv('MOBILE_AUTH_SECRET', '');
    vi.stubEnv('AUTH_SECRET', 'a'.repeat(32));

    expect(mobileApiIsEnabled()).toBe(false);
  });
});
