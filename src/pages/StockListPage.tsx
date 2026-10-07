import { useEffect, useRef, useState } from 'react';
import { useSearchParamsState } from '../hooks/useSearchParamsState';
import { useStockList, useCategories, usePrefetchNextPage } from '../hooks/useStock';
import { PAGE_SIZE } from '../api/products';
import { SearchBox } from '../components/SearchBox';
import { CategoryFilter, SortControl, Pagination } from '../components/StockControls';
import { StockTable, StockTableSkeleton } from '../components/StockTable';
import { EmptyState, ErrorState } from '../components/DataState';
import { describeLoadError } from '../api/errors';

export function StockListPage() {
  const { state, setSearch, setCategory, setSort, setPage, clearFilters } =
    useSearchParamsState();
  const categoriesQuery = useCategories();
  const listQuery = useStockList(state);
  const listTopRef = useRef<HTMLDivElement>(null);
  // True while the search box holds text that hasn't been committed yet.
  // The list below still belongs to the previous term, so it is dimmed and
  // marked busy rather than presented as results for what is typed.
  const [searchPending, setSearchPending] = useState(false);

  usePrefetchNextPage(
    state,
    listQuery.isPlaceholderData ? undefined : listQuery.data?.pageCount,
  );

  // A valid-but-out-of-range page (from a stale shared link, or a filter
  // that shrank the result set) is clamped to the last available page once
  // the real total is known. This is what stops a filter change stranding
  // the user on an empty page.
  useEffect(() => {
    if (!listQuery.data || listQuery.isPlaceholderData) return;
    const { page, pageCount } = listQuery.data;
    if (page > pageCount) setPage(pageCount);
  }, [listQuery.data, listQuery.isPlaceholderData, setPage]);

  function changePage(page: number) {
    setPage(page);
    // Pagination sits below the list: bring the top of the new page into
    // view rather than leaving the user at the bottom of it.
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    listTopRef.current?.scrollIntoView({
      block: 'start',
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }

  const hasFilters = Boolean(state.q || state.category);
  const data = listQuery.data;
  // A page past the end is about to be clamped by the effect above: show
  // the loading state for that instant rather than a misleading empty page.
  const outOfRange = Boolean(data && data.page > data.pageCount);
  // While the next page or sort loads, the previous results stay on screen
  // (dimmed) instead of being replaced by a loading state.
  const isSwitching =
    (listQuery.isPlaceholderData && listQuery.isFetching) || searchPending;

  // No data at all: the error replaces the list. Data already on screen
  // and only a background refresh failed: keep the list, say so above it.
  const loadFailed = listQuery.isError && !data;
  const refreshFailed = listQuery.isError && Boolean(data);

  const firstItem = data ? (data.page - 1) * PAGE_SIZE + 1 : 0;
  const lastItem = data ? firstItem + data.products.length - 1 : 0;

  return (
    <div>
      <div
        ref={listTopRef}
        className="mb-5 flex scroll-mt-24 flex-wrap items-end justify-between gap-x-6 gap-y-1"
      >
        <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          Stock list
        </h1>
        <p className="text-slate" aria-live="polite">
          {data && data.total > 0
            ? `Showing ${firstItem}–${lastItem} of ${data.total} items`
            : ' '}
        </p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2.5 md:flex md:items-center">
        <div className="col-span-2 md:flex-1">
          <SearchBox
            committedValue={state.q}
            onCommit={setSearch}
            onPendingChange={setSearchPending}
          />
        </div>
        <CategoryFilter
          categories={categoriesQuery.data ?? []}
          value={state.category}
          onChange={setCategory}
          disabled={categoriesQuery.isPending}
        />
        <SortControl sortBy={state.sortBy} order={state.order} onChange={setSort} />
      </div>

      {categoriesQuery.isError && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber/30 bg-amber-bg px-4 py-3 text-amber"
        >
          <span className="font-semibold">
            Couldn&apos;t load the category list. Search and sorting still work.
          </span>
          <button
            type="button"
            onClick={() => categoriesQuery.refetch()}
            className="press h-11 rounded-lg border border-amber/40 bg-surface px-4 font-semibold hover:border-amber"
          >
            Reload categories
          </button>
        </div>
      )}

      {(listQuery.isPending || outOfRange) && <StockTableSkeleton />}

      {loadFailed && (
        <ErrorState
          message={describeLoadError(listQuery.error, 'the stock list')}
          onRetry={() => listQuery.refetch()}
        />
      )}

      {refreshFailed && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber/30 bg-amber-bg px-4 py-3 text-amber"
        >
          <span className="font-semibold">
            Couldn't refresh. These are the last counts that loaded.
          </span>
          <button
            type="button"
            onClick={() => listQuery.refetch()}
            className="press h-11 rounded-lg border border-amber/40 bg-surface px-4 font-semibold hover:border-amber"
          >
            Try again
          </button>
        </div>
      )}

      {data && !outOfRange && data.products.length === 0 && (
        <EmptyState
          title={
            state.q
              ? `No items match "${state.q}"`
              : state.category
                ? 'No items in this category'
                : 'No stock items to show'
          }
          description="Try a different search term, or clear the filters to see everything."
          action={
            hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="press mt-3 h-11 rounded-xl bg-lagoon px-5 font-semibold text-white hover:bg-lagoon-deep"
              >
                Clear filters
              </button>
            ) : undefined
          }
        />
      )}

      {data && !outOfRange && data.products.length > 0 && (
        <div
          aria-busy={isSwitching}
          className={`transition-opacity duration-200 ${isSwitching ? 'opacity-55' : ''}`}
        >
          <StockTable products={data.products} />
          <div className="mt-5">
            <Pagination
              page={data.page}
              pageCount={data.pageCount}
              total={data.total}
              onChange={changePage}
            />
          </div>
        </div>
      )}
    </div>
  );
}
