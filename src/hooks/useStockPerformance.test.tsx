import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from '../auth/AuthContext';
import { useStockItem, useStockList } from './useStock';
import { searchParamsDefaults } from './useSearchParamsState';
import { shouldRetryQuery } from '../api/retry';
import { ApiError } from '../api/types';
import { installFakeApi, LISTED_ITEM, seedSession } from '../test/fakeApi';
import type { StockListParams } from '../api/products';

/** Like AuthGuard: renders nothing until the stored session is restored. */
function SessionGate({ children }: { children: ReactNode }) {
  const { user, isRestoring } = useAuth();
  return !isRestoring && user ? children : null;
}

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SessionGate>{children}</SessionGate>
        </AuthProvider>
      </QueryClientProvider>
    );
  };
}

function newQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('stock data performance', () => {
  it('opens an item instantly from list data while the fresh copy loads', async () => {
    const api = installFakeApi('current');
    seedSession('current');
    // Hold the detail request open so we can see what renders before it lands.
    api.onItem = () => new Promise<Response>(() => {});
    const queryClient = newQueryClient();
    const wrapper = makeWrapper(queryClient);

    const list = renderHook(() => ({ list: useStockList(searchParamsDefaults) }), {
      wrapper,
    });
    await waitFor(() => expect(list.result.current?.list.isSuccess).toBe(true));

    const item = renderHook(() => useStockItem(LISTED_ITEM.id), { wrapper });

    // The detail request never answers in this test, so any data shown
    // here can only have come from the list already in the cache.
    await waitFor(() => expect(item.result.current).toBeTruthy());
    expect(item.result.current?.data?.title).toBe(LISTED_ITEM.title);
    expect(item.result.current?.isPlaceholderData).toBe(true);
    await waitFor(() =>
      expect(api.calls.some((c) => c.path === `/products/${LISTED_ITEM.id}`)).toBe(
        true,
      ),
    );
  });

  it('downloads the search match set once when paging within search + category', async () => {
    const api = installFakeApi('current');
    seedSession('current');
    const wrapper = makeWrapper(newQueryClient());
    const base: StockListParams = {
      ...searchParamsDefaults,
      q: 'bandage',
      category: 'wound-care',
    };

    const { result, rerender } = renderHook(
      ({ params }) => ({ list: useStockList(params) }),
      { wrapper, initialProps: { params: base } },
    );
    await waitFor(() => expect(result.current?.list.data?.page).toBe(1));
    expect(result.current?.list.data?.total).toBe(25);

    rerender({ params: { ...base, page: 2 } });
    await waitFor(() => expect(result.current?.list.data?.page).toBe(2));
    expect(result.current?.list.data?.products).toHaveLength(5);

    rerender({ params: { ...base, sortBy: 'stock', order: 'desc' } });
    await waitFor(() => expect(result.current?.list.isPlaceholderData).toBe(false));

    const searches = api.calls.filter((c) => c.path.startsWith('/products/search'));
    expect(searches).toHaveLength(1);
  });

  it('keeps showing the current page while the next one loads', async () => {
    const api = installFakeApi('current');
    seedSession('current');
    const wrapper = makeWrapper(newQueryClient());

    const { result, rerender } = renderHook(
      ({ params }) => ({ list: useStockList(params) }),
      { wrapper, initialProps: { params: searchParamsDefaults } },
    );
    await waitFor(() => expect(result.current?.list.isSuccess).toBe(true));
    api.calls.length = 0;

    rerender({ params: { ...searchParamsDefaults, sortBy: 'stock' } });

    expect(result.current?.list.data?.products[0].id).toBe(LISTED_ITEM.id);
    expect(result.current?.list.isPlaceholderData).toBe(true);
    await waitFor(() => expect(result.current?.list.isPlaceholderData).toBe(false));
  });
});

describe('shouldRetryQuery', () => {
  it('retries a network or server failure once', () => {
    expect(shouldRetryQuery(0, new TypeError('Failed to fetch'))).toBe(true);
    expect(shouldRetryQuery(0, new ApiError('Request failed (503)', 503))).toBe(true);
    expect(shouldRetryQuery(1, new ApiError('Request failed (503)', 503))).toBe(false);
  });

  it('does not retry a request the server rejected, such as a missing item', () => {
    expect(shouldRetryQuery(0, new ApiError('Request failed (404)', 404))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError('Session expired', 401))).toBe(false);
  });
});
