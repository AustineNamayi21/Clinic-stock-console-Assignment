import type { SortField, SortOrder } from '../api/products';

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
        className="w-full rounded-md border border-line bg-surface px-3 py-2 text-ink disabled:opacity-60 sm:w-auto"
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c.replace(/-/g, ' ')}
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
  { value: 'title-asc', sortBy: 'title', order: 'asc', label: 'Name (A–Z)' },
  { value: 'title-desc', sortBy: 'title', order: 'desc', label: 'Name (Z–A)' },
  {
    value: 'stock-asc',
    sortBy: 'stock',
    order: 'asc',
    label: 'Stock (lowest first)',
  },
  {
    value: 'stock-desc',
    sortBy: 'stock',
    order: 'desc',
    label: 'Stock (highest first)',
  },
  {
    value: 'price-asc',
    sortBy: 'price',
    order: 'asc',
    label: 'Price (lowest first)',
  },
  {
    value: 'price-desc',
    sortBy: 'price',
    order: 'desc',
    label: 'Price (highest first)',
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
        className="w-full rounded-md border border-line bg-surface px-3 py-2 text-ink sm:w-auto"
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
  return (
    <nav
      aria-label="Stock list pages"
      className="flex items-center justify-between gap-4 border-t border-line pt-4"
    >
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
      >
        Previous
      </button>

      <span className="text-center text-sm text-slate" aria-live="polite">
        Page {page} of {pageCount}
        <span className="hidden sm:inline"> · {total} items</span>
      </span>

      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= pageCount}
        className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next
      </button>
    </nav>
  );
}
