jest.mock('@/config/app-mode', () => ({ isOfflineBuild: true }));
jest.mock('@/data/db', () => ({
  clearLocalData: jest.fn(),
  getProfile: jest.fn(),
  saveProfile: jest.fn(),
}));

import { mobileRequest } from '@/sync/api';

describe('offline build network guard', () => {
  it('rejects before fetch can contact a server', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');

    await expect(mobileRequest('/api/mobile/v1/auth/login')).rejects.toMatchObject({
      problem: 'mobile_api_disabled',
    });
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});
