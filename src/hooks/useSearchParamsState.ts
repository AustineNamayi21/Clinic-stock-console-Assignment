import { useCallback, useMemo } from 'react';
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
}

/**
 * Reads the committed list state (search, category, sort, page) from the
 * URL and validates it at the boundary: unrecognised sort values fall back
 * to documented defaults, and non-positive/non-numeric pages fall back to
 * page 1. This is the single source of truth for committed list state.
 */
export function useSearchParamsState(): UseSearchParamsStateResult {
  const [searchParams, setSearchParams] = useSearchParams();

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
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (q) next.set('q', q);
          else next.delete('q');
          next.set('page', '1');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setCategory = useCallback(
    (category: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (category) next.set('category', category);
        else next.delete('category');
        next.set('page', '1');
        return next;
      });
    },
    [setSearchParams],
  );

  const setSort = useCallback(
    (sortBy: SortField, order: SortOrder) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('sortBy', sortBy);
        next.set('order', order);
        next.set('page', '1');
        return next;
      });
    },
    [setSearchParams],
  );

  const setPage = useCallback(
    (page: number) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('page', String(page));
        return next;
      });
    },
    [setSearchParams],
  );

  return { state, setSearch, setCategory, setSort, setPage };
}

export { DEFAULTS as searchParamsDefaults };
