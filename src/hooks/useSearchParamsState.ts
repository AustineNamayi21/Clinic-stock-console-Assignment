import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { SortField, SortOrder, StockListParams } from '../api/products';

const DEFAULTS: StockListParams = {
  q: '',
  category: '',
  sortBy: 'title',
  order: 'asc',
  page: 1,
};

const VALID_SORT_FIELDS: SortField[] = ['title', 'price', 'stock'];
const VALID_ORDERS: SortOrder[] = ['asc', 'desc'];

function parseSortField(value: string | null): SortField {
  return VALID_SORT_FIELDS.includes(value as SortField)
    ? (value as SortField)
    : DEFAULTS.sortBy;
}

function parseOrder(value: string | null): SortOrder {
  return VALID_ORDERS.includes(value as SortOrder)
    ? (value as SortOrder)
    : DEFAULTS.order;
}

function parsePage(value: string | null): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : DEFAULTS.page;
}

export interface UseSearchParamsStateResult {
  state: StockListParams;
  setSearch: (q: string) => void;
  setCategory: (category: string) => void;
  setSort: (sortBy: SortField, order: SortOrder) => void;
  setPage: (page: number) => void;
  /** Clears search and category together, in one URL update. */
  clearFilters: () => void;
}

/**
 * Reads the committed list state (search, category, sort, page) from the
 * URL and validates it at the boundary: unrecognised sort values fall back
 * to documented defaults, and non-positive/non-numeric pages fall back to
 * page 1. This is the single source of truth for committed list state.
 */
export function useSearchParamsState(): UseSearchParamsStateResult {
  const [searchParams, setSearchParams] = useSearchParams();

  // React Router hands a functional update the params from the last
  // render, not from the last update. Two changes made before the screen
  // re-renders (category then sort on a slow tablet, say) would otherwise
  // each start from the same old URL, and the second would silently undo
  // the first. Every update below starts from this ref instead: it holds
  // the most recent URL this hook produced, and is re-synced from the
  // router after each render (which also picks up back/forward).
  const latest = useRef(searchParams);
  useLayoutEffect(() => {
    latest.current = searchParams;
  }, [searchParams]);

  const update = useCallback(
    (change: (next: URLSearchParams) => void, options?: { replace?: boolean }) => {
      const next = new URLSearchParams(latest.current);
      change(next);
      latest.current = next;
      setSearchParams(next, options);
    },
    [setSearchParams],
  );

  const state = useMemo<StockListParams>(
    () => ({
      q: searchParams.get('q') ?? DEFAULTS.q,
      category: searchParams.get('category') ?? DEFAULTS.category,
      sortBy: parseSortField(searchParams.get('sortBy')),
      order: parseOrder(searchParams.get('order')),
      page: parsePage(searchParams.get('page')),
    }),
    [searchParams],
  );

  const setSearch = useCallback(
    (q: string) => {
      // Replace rather than push, so Back isn't filled with every search term.
      update(
        (next) => {
          if (q) next.set('q', q);
          else next.delete('q');
          next.set('page', '1');
        },
        { replace: true },
      );
    },
    [update],
  );

  const setCategory = useCallback(
    (category: string) => {
      update((next) => {
        if (category) next.set('category', category);
        else next.delete('category');
        next.set('page', '1');
      });
    },
    [update],
  );

  const setSort = useCallback(
    (sortBy: SortField, order: SortOrder) => {
      update((next) => {
        next.set('sortBy', sortBy);
        next.set('order', order);
        next.set('page', '1');
      });
    },
    [update],
  );

  const setPage = useCallback(
    (page: number) => {
      update((next) => {
        next.set('page', String(page));
      });
    },
    [update],
  );

  const clearFilters = useCallback(() => {
    update((next) => {
      next.delete('q');
      next.delete('category');
      next.set('page', '1');
    });
  }, [update]);

  return { state, setSearch, setCategory, setSort, setPage, clearFilters };
}

export { DEFAULTS as searchParamsDefaults };
