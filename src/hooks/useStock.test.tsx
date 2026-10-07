import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from '../auth/AuthContext';
import { useStockItem, useUpdateStock } from './useStock';
import { getStockOverride, setStockOverride } from '../lib/stockOverrides';
import { installFakeApi, seedSession } from '../test/fakeApi';

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    );
  };
}

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('useUpdateStock', () => {
  it('saves a correction after the access token has expired mid-session', async () => {
    const api = installFakeApi('current');
    seedSession('current');
    const { result } = renderHook(
      () => ({ auth: useAuth(), save: useUpdateStock(1) }),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.auth.user).not.toBeNull());

    // A minute passes on the shelf count: the token the app holds expires.
    api.validToken = 'expired-and-replaced';
    api.calls.length = 0;

    act(() => result.current.save.mutate(5));
    await waitFor(() => expect(result.current.save.isPending).toBe(false));

    expect(result.current.save.isSuccess).toBe(true);
    const puts = api.calls.filter((c) => c.method === 'PUT');
    expect(puts).toHaveLength(2);
    expect(puts[1].auth).toBe(`Bearer ${api.validToken}`);
  });

  it('shows a second correction of the same item immediately, while it is saving', async () => {
    const api = installFakeApi('current');
    seedSession('current');
    setStockOverride(1, 7); // an earlier correction this session

    let releasePut!: () => void;
    api.onPut = () =>
      new Promise((resolve) => {
        releasePut = () => resolve(new Response(JSON.stringify({ id: 1, stock: 9 })));
      });

    const { result } = renderHook(
      () => ({ auth: useAuth(), item: useStockItem(1), save: useUpdateStock(1) }),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.item.data?.stock).toBe(7));

    act(() => result.current.save.mutate(9));
    await waitFor(() => expect(result.current.save.isPending).toBe(true));
    await waitFor(() => expect(result.current.item.data?.stock).toBe(9));

    await act(async () => releasePut());
    await waitFor(() => expect(result.current.save.isSuccess).toBe(true));
    expect(getStockOverride(1)).toBe(9);
  });

  it('restores the previous correction if the save fails', async () => {
    const api = installFakeApi('current');
    seedSession('current');
    setStockOverride(1, 7);
    api.onPut = async () => new Response('{}', { status: 500 });

    const { result } = renderHook(
      () => ({ auth: useAuth(), item: useStockItem(1), save: useUpdateStock(1) }),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.item.data?.stock).toBe(7));

    act(() => result.current.save.mutate(9));
    await waitFor(() => expect(result.current.save.isError).toBe(true));

    expect(getStockOverride(1)).toBe(7);
    await waitFor(() => expect(result.current.item.data?.stock).toBe(7));
  });
});
