import { useEffect, useRef } from 'react';
import type { SortField, SortOrder } from '../api/products';
import { ChevronLeft, ChevronRight } from './Icons';

/** 'kitchen-accessories' -> 'Kitchen accessories' */
function categoryName(slug: string) {
  const words = slug.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const CONTROL =
  'h-12 w-full rounded-xl border border-line bg-surface px-3.5 text-base text-ink transition-colors hover:border-slate/40 focus:border-lagoon';

export function CategoryFilter({
  categories,
  value,
  onChange,
  disabled,
}: {
  categories: string[];
  value: string;
  onChange: (category: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label htmlFor="category-filter" className="sr-only">
        Filter by category
      </label>
      <select
        id="category-filter"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`select ${CONTROL} disabled:opacity-60 md:w-52`}
      >
        <option value="">All categories</option>
        {/* A category from the URL is shown even before (or if) the list of
            categories loads, so a reloaded or shared link never displays
            "All categories" over a filtered list. */}
        {value && !categories.includes(value) && (
          <option value={value}>{categoryName(value)}</option>
        )}
        {categories.map((c) => (
          <option key={c} value={c}>
            {categoryName(c)}
          </option>
        ))}
      </select>
    </div>
  );
}

const SORT_OPTIONS: Array<{
  value: string;
  sortBy: SortField;
  order: SortOrder;
  label: string;
}> = [
  { value: 'title-asc', sortBy: 'title', order: 'asc', label: 'Name A–Z' },
  { value: 'title-desc', sortBy: 'title', order: 'desc', label: 'Name Z–A' },
  {
    value: 'stock-asc',
    sortBy: 'stock',
    order: 'asc',
    label: 'Lowest stock',
  },
  {
    value: 'stock-desc',
    sortBy: 'stock',
    order: 'desc',
    label: 'Highest stock',
  },
  {
    value: 'price-asc',
    sortBy: 'price',
    order: 'asc',
    label: 'Lowest price',
  },
  {
    value: 'price-desc',
    sortBy: 'price',
    order: 'desc',
    label: 'Highest price',
  },
];

export function SortControl({
  sortBy,
  order,
  onChange,
}: {
  sortBy: SortField;
  order: SortOrder;
  onChange: (sortBy: SortField, order: SortOrder) => void;
}) {
  return (
    <div>
      <label htmlFor="sort-control" className="sr-only">
        Sort stock
      </label>
      <select
        id="sort-control"
        value={`${sortBy}-${order}`}
        onChange={(e) => {
          const opt = SORT_OPTIONS.find((o) => o.value === e.target.value);
          if (opt) onChange(opt.sortBy, opt.order);
        }}
        className={`select ${CONTROL} md:w-48`}
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

const PAGE_BUTTON =
  'press inline-flex h-12 items-center gap-1.5 rounded-xl border border-line bg-surface px-4 font-semibold text-ink hover:border-lagoon hover:text-lagoon-deep disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink';

export function Pagination({
  page,
  pageCount,
  total,
  onChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const previousRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  // Reaching the first or last page disables the button that was just
  // pressed. Hand keyboard focus to the other one, so a keyboard user isn't
  // left sitting on a control that no longer does anything.
  useEffect(() => {
    if (page >= pageCount && document.activeElement === nextRef.current) {
      previousRef.current?.focus();
    } else if (page <= 1 && document.activeElement === previousRef.current) {
      nextRef.current?.focus();
    }
  }, [page, pageCount]);

  return (
    <nav
      aria-label="Stock list pages"
      className="flex items-center justify-between gap-3"
    >
      <button
        type="button"
        ref={previousRef}
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className={PAGE_BUTTON}
      >
        <ChevronLeft className="h-5 w-5" />
        Previous
      </button>

      <span className="text-center text-sm text-slate" aria-live="polite">
        Page <span className="font-bold text-ink">{page}</span> of {pageCount}
        <span className="hidden sm:inline">, {total} items</span>
      </span>

      <button
        type="button"
        ref={nextRef}
        onClick={() => onChange(page + 1)}
        disabled={page >= pageCount}
        className={PAGE_BUTTON}
      >
        Next
        <ChevronRight className="h-5 w-5" />
      </button>
    </nav>
  );
}
