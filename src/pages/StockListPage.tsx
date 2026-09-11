import { useEffect } from 'react';
import { useSearchParamsState } from '../hooks/useSearchParamsState';
import { useStockList, useCategories } from '../hooks/useStock';
import { SearchBox } from '../components/SearchBox';
import { CategoryFilter, SortControl, Pagination } from '../components/StockControls';
import { StockTable } from '../components/StockTable';
import { LoadingState, EmptyState, ErrorState } from '../components/DataState';

export function StockListPage() {
  const { state, setSearch, setCategory, setSort, setPage } = useSearchParamsState();
  const categoriesQuery = useCategories();
  const listQuery = useStockList(state);

  // A valid-but-out-of-range page (from a stale shared link, or a filter
  // that shrank the result set) is clamped to the last available page once
  // the real total is known. This is what stops a filter change stranding
  // the user on an empty page.
  useEffect(() => {
    if (!listQuery.data) return;
    const { page, pageCount } = listQuery.data;
    if (page > pageCount) setPage(pageCount);
  }, [listQuery.data, setPage]);

  const hasFilters = Boolean(state.q || state.category);

  function clearFilters() {
    setSearch('');
    setCategory('');
  }

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-ink">Stock list</h1>

      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchBox committedValue={state.q} onCommit={setSearch} />
        <CategoryFilter
          categories={categoriesQuery.data ?? []}
          value={state.category}
          onChange={setCategory}
          disabled={categoriesQuery.isPending}
        />
        <SortControl sortBy={state.sortBy} order={state.order} onChange={setSort} />
      </div>

      {listQuery.isPending && <LoadingState label="Loading stock…" />}

      {listQuery.isError && (
        <ErrorState
          message="Couldn't load the stock list."
          onRetry={() => listQuery.refetch()}
        />
      )}

      {listQuery.isSuccess && listQuery.data.products.length === 0 && (
        <EmptyState
          title={state.q ? `No items match "${state.q}"` : 'No items in this category'}
          description="Try a different search term, or clear the filters to see everything."
          action={
            hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-2 rounded-md border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface"
              >
                Clear filters
              </button>
            ) : undefined
          }
        />
      )}

      {listQuery.isSuccess && listQuery.data.products.length > 0 && (
        <>
          <StockTable products={listQuery.data.products} />
          <div className="mt-5">
            <Pagination
              page={listQuery.data.page}
              pageCount={listQuery.data.pageCount}
              total={listQuery.data.total}
              onChange={setPage}
            />
          </div>
        </>
      )}
    </div>
  );
}
