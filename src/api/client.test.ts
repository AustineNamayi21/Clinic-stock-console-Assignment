import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from './client';
import { ApiError } from './types';
import { installFakeApi } from '../test/fakeApi';

afterEach(() => vi.unstubAllGlobals());

describe('createApiClient', () => {
  it('retries a 401 with the token the refresh returned, not a stale one', async () => {
    const api = installFakeApi('expired-elsewhere');
    // Simulates a client created before the refresh: it only ever knows
    // the old token. The retry must not depend on it.
    const client = createApiClient(
      () => 'old',
      async () => 'fresh',
    );
    api.validToken = 'fresh';

    await expect(client.fetch('/products/1')).resolves.toMatchObject({ id: 1 });
    expect(api.calls.map((c) => c.auth)).toEqual(['Bearer old', 'Bearer fresh']);
  });

  it('reuses a token another request already refreshed instead of refreshing again', async () => {
    const api = installFakeApi('new');
    let current = 'old';
    const refresh = vi.fn(async () => 'never');
    const client = createApiClient(() => current, refresh);

    // The request goes out with 'old'; by the time the 401 lands, a
    // concurrent request has already swapped in 'new'.
    const pending = client.fetch('/products/1');
    current = 'new';

    await expect(pending).resolves.toMatchObject({ id: 1 });
    expect(refresh).not.toHaveBeenCalled();
    expect(api.calls.map((c) => c.auth)).toEqual(['Bearer old', 'Bearer new']);
  });

  it('reports "Session expired" when the API rejects the refresh', async () => {
    installFakeApi('nobody-has-this');
    const client = createApiClient(
      () => 'old',
      async () => {
        throw new ApiError('Refresh failed', 403);
      },
    );

    await expect(client.fetch('/products/1')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Session expired',
      status: 401,
    });
  });

  it('surfaces a network failure during refresh as a network error, not a sign-out', async () => {
    installFakeApi('nobody-has-this');
    const client = createApiClient(
      () => 'old',
      async () => {
        throw new TypeError('Failed to fetch');
      },
    );

    await expect(client.fetch('/products/1')).rejects.toBeInstanceOf(TypeError);
  });
});
