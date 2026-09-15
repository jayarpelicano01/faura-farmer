import { resolveAppMode } from '@/config/app-mode';

describe('build app mode', () => {
  it('accepts the offline mode explicitly', () => {
    expect(resolveAppMode('offline')).toBe('offline');
  });

  it('defaults unknown configuration to the online-capable mode', () => {
    expect(resolveAppMode(undefined)).toBe('online');
    expect(resolveAppMode('unexpected')).toBe('online');
  });
});
