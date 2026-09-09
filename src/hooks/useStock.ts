import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useApiClient } from './useApiClient';
import {
  fetchStockList,
  fetchProduct,
  fetchCategories,
  updateStock,
  type StockListParams,
} from '../api/products';
import { applyStockOverride, setStockOverride } from '../lib/stockOverrides';
import type { Product } from '../api/types';

/** Query keys are built directly from the committed URL state that
 * produces each response, so revisiting a previously-seen combination of
 * search/filter/sort/page is an instant cache hit. */
export const stockKeys = {
  list: (params: StockListParams) => ['products', 'list', params] as const,
  item: (id: number) => ['products', 'item', id] as const,
  categories: () => ['categories'] as const,
};

export function useStockList(params: StockListParams) {
  const client = useApiClient();
  return useQuery({
    queryKey: stockKeys.list(params),
    queryFn: ({ signal }) => fetchStockList(client, params, signal),
    // Stock counts can change from a physical count at any time; this is an
    // internal tool where slightly-too-frequent refetching is safer than a
    // stale count. Backgrounded ward tablets also refocus often.
    staleTime: 30_000,
    select: (data) => ({
      ...data,
      products: data.products.map(applyStockOverride),
    }),
  });
}

export function useStockItem(id: number) {
  const client = useApiClient();
  return useQuery({
    queryKey: stockKeys.item(id),
    queryFn: ({ signal }) => fetchProduct(client, id, signal),
    staleTime: 30_000,
    select: applyStockOverride,
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
      // Optimistic update: reflect the new count immediately rather than
      // leaving the user waiting with no feedback on a slow connection.
      queryClient.setQueryData<Product>(stockKeys.item(productId), (old) =>
        old ? { ...old, stock } : old,
      );
      return { previous };
    },
    onError: (_err, _stock, context) => {
      // Roll back the optimistic value if the request failed.
      if (context?.previous) {
        queryClient.setQueryData(stockKeys.item(productId), context.previous);
      }
    },
    onSuccess: (_data, stock) => {
      // DummyJSON doesn't persist the write server-side, so a later
      // background refetch would silently revert this. The override store
      // is the session-scoped source of truth for this item from here on.
      setStockOverride(productId, stock);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: stockKeys.item(productId) });
      queryClient.invalidateQueries({ queryKey: ['products', 'list'] });
    },
  });
}
