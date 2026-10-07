import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { installFakeApi, seedSession, TEST_USER } from '../test/fakeApi';

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('AuthProvider session restore', () => {
  it('restores a session whose access token expired by refreshing it, rather than signing out', async () => {
    // Stored token is 'stale'; the API only accepts tokens issued after a refresh.
    const api = installFakeApi('not-issued-yet');
    seedSession('stale');

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isRestoring).toBe(false));

    expect(result.current.user).toEqual(TEST_USER);
    expect(result.current.getAccessToken()).toBe(api.validToken);
    expect(sessionStorage.getItem('csc:refreshToken')).not.toBeNull();
    expect(api.calls.some((c) => c.path === '/auth/refresh')).toBe(true);
  });

  it('ends the session when the refresh token is rejected too', async () => {
    const api = installFakeApi('not-issued-yet');
    api.refreshAllowed = false;
    seedSession('stale');

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isRestoring).toBe(false));

    expect(result.current.user).toBeNull();
    expect(sessionStorage.getItem('csc:accessToken')).toBeNull();
    expect(sessionStorage.getItem('csc:refreshToken')).toBeNull();
  });

  it('keeps the stored session when the network is down on reload', async () => {
    const api = installFakeApi('stale');
    api.offline = true;
    seedSession('stale');

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isRestoring).toBe(false));

    expect(result.current.user).toEqual(TEST_USER);
    expect(sessionStorage.getItem('csc:refreshToken')).toBe('refresh-0');
  });
});

describe('AuthProvider refresh', () => {
  it('clears the session when a mid-session refresh is rejected, so AuthGuard redirects to login', async () => {
    const api = installFakeApi('current');
    seedSession('current');
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).not.toBeNull());

    api.refreshAllowed = false;
    await expect(result.current.refreshAccessToken()).rejects.toThrow();

    await waitFor(() => expect(result.current.user).toBeNull());
    expect(sessionStorage.getItem('csc:accessToken')).toBeNull();
  });

  it('shares one refresh between concurrent callers', async () => {
    const api = installFakeApi('current');
    seedSession('current');
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).not.toBeNull());

    const [a, b, c] = await Promise.all([
      result.current.refreshAccessToken(),
      result.current.refreshAccessToken(),
      result.current.refreshAccessToken(),
    ]);

    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(api.calls.filter((call) => call.path === '/auth/refresh')).toHaveLength(1);
  });
});
