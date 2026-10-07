import { useCallback, useEffect, useSyncExternalStore } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { useApiClient } from './useApiClient';
import {
  fetchAllSearchMatches,
  fetchCategories,
  fetchProduct,
  fetchStockList,
  updateStock,
  type StockListParams,
  type StockListResult,
} from '../api/products';
import {
  clearStockOverride,
  getStockOverride,
  getStockOverridesSnapshot,
  setStockOverride,
  subscribeToStockOverrides,
  withStockOverride,
} from '../lib/stockOverrides';
import type { ApiClient } from '../api/client';
import type { Product } from '../api/types';

/** Query keys are built directly from the committed URL state that
 * produces each response, so revisiting a previously-seen combination of
 * search/filter/sort/page is an instant cache hit. */
export const stockKeys = {
  list: (params: StockListParams) => ['products', 'list', params] as const,
  item: (id: number) => ['products', 'item', id] as const,
  searchMatches: (q: string) => ['products', 'search-matches', q] as const,
  categories: () => ['categories'] as const,
};

// Stock counts can change from a physical count at any time; this is an
// internal tool where slightly-too-frequent refetching is safer than a
// stale count. Backgrounded ward tablets also refocus often.
const STOCK_STALE_TIME = 30_000;

/**
 * The current session's stock corrections. Re-renders when one is made,
 * so `select` re-applies overrides immediately instead of waiting for the
 * next refetch.
 */
function useStockOverrides() {
  return useSyncExternalStore(
    subscribeToStockOverrides,
    getStockOverridesSnapshot,
    getStockOverridesSnapshot,
  );
}

function stockListQueryOptions(
  client: ApiClient,
  queryClient: QueryClient,
  params: StockListParams,
) {
  return {
    queryKey: stockKeys.list(params),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchStockList(client, params, signal, (q) =>
        // The full match set for a search term is cached on its own, so
        // paging, sorting or switching category within the same search is
        // computed locally instead of downloading every match again.
        queryClient.fetchQuery({
          queryKey: stockKeys.searchMatches(q),
          queryFn: ({ signal: s }) => fetchAllSearchMatches(client, q, s),
          staleTime: STOCK_STALE_TIME,
        }),
      ),
    staleTime: STOCK_STALE_TIME,
  };
}

export function useStockList(params: StockListParams) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const overrides = useStockOverrides();

  const select = useCallback(
    (data: StockListResult) => ({
      ...data,
      products: data.products.map((p) => withStockOverride(p, overrides)),
    }),
    [overrides],
  );

  return useQuery({
    ...stockListQueryOptions(client, queryClient, params),
    // Keep showing the current page while the next one loads, instead of
    // replacing the list with a loading state on every page, sort or
    // filter change. The page dims and the header line shows activity.
    placeholderData: keepPreviousData,
    select,
  });
}

/** Fetches the page after `params` into the cache so "Next" is instant. */
export function usePrefetchNextPage(params: StockListParams, pageCount?: number) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { q, category, sortBy, order, page } = params;

  useEffect(() => {
    if (!pageCount || page >= pageCount) return;
    const next = { q, category, sortBy, order, page: page + 1 };
    // Wait for the browser to be idle so this never competes with the
    // request the user is actually waiting for.
    const run = () =>
      queryClient.prefetchQuery(stockListQueryOptions(client, queryClient, next));
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(run, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(run, 300);
    return () => window.clearTimeout(id);
  }, [client, queryClient, q, category, sortBy, order, page, pageCount]);
}

/** Finds an item in any stock-list page already in the cache. */
function findInListCache(queryClient: QueryClient, id: number): Product | undefined {
  for (const [, data] of queryClient.getQueriesData<StockListResult>({
    queryKey: ['products', 'list'],
  })) {
    const match = data?.products.find((p) => p.id === id);
    if (match) return match;
  }
  return undefined;
}

export function useStockItem(id: number) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const overrides = useStockOverrides();

  const select = useCallback(
    (product: Product) => withStockOverride(product, overrides),
    [overrides],
  );

  return useQuery({
    queryKey: stockKeys.item(id),
    queryFn: ({ signal }) => fetchProduct(client, id, signal),
    staleTime: STOCK_STALE_TIME,
    // The list already fetched everything the detail page shows, so an item
    // opened from the list renders instantly from that data while the
    // fresh copy loads in the background.
    placeholderData: () => findInListCache(queryClient, id),
    select,
    enabled: Number.isInteger(id) && id > 0,
  });
}

export function useCategories() {
  const client = useApiClient();
  return useQuery({
    queryKey: stockKeys.categories(),
    queryFn: ({ signal }) => fetchCategories(client, signal),
    // Categories change rarely - avoid refetching per list-page mount on
    // a patchy connection.
    staleTime: 10 * 60_000,
  });
}

export function useUpdateStock(productId: number) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (stock: number) => updateStock(client, productId, stock),
    onMutate: async (stock: number) => {
      await queryClient.cancelQueries({ queryKey: stockKeys.item(productId) });
      const previous = queryClient.getQueryData<Product>(stockKeys.item(productId));
      const previousOverride = getStockOverride(productId);
      // Optimistic update: reflect the new count immediately rather than
      // leaving the user waiting with no feedback on a slow connection.
      //
      // DummyJSON doesn't persist the write server-side, so the override
      // store is the session-scoped source of truth for corrected counts.
      // It's written here, not on success: the queries' `select` applies
      // overrides on top of cached data, so an older override for this item
      // would otherwise hide the optimistic value until the save finished.
      setStockOverride(productId, stock);
      queryClient.setQueryData<Product>(stockKeys.item(productId), (old) =>
        old ? { ...old, stock } : old,
      );
      return { previous, previousOverride };
    },
    onError: (_err, _stock, context) => {
      // Roll back both the override and the cached value if the request failed.
      if (context?.previousOverride === undefined) clearStockOverride(productId);
      else setStockOverride(productId, context.previousOverride);
      if (context?.previous) {
        queryClient.setQueryData(stockKeys.item(productId), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: stockKeys.item(productId) });
      queryClient.invalidateQueries({ queryKey: ['products', 'list'] });
    },
  });
}
