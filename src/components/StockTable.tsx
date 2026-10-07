import type { CSSProperties } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { Product } from '../api/types';
import { StockFigure } from './StockBadge';
import { ChevronRight } from './Icons';

function categoryLabel(category: string) {
  return category.replace(/-/g, ' ');
}

function CategoryTag({ category }: { category: string }) {
  return (
    <span className="inline-block rounded-full bg-lagoon-bg px-2.5 py-0.5 text-xs font-semibold text-lagoon-deep capitalize">
      {categoryLabel(category)}
    </span>
  );
}

export function StockTable({ products }: { products: Product[] }) {
  // Item links carry the list's URL (search, filter, sort, page), so the
  // item page's back link returns to exactly this view.
  const { search } = useLocation();
  const listState = { fromList: search };

  // Remount the rows only when the set of items changes (a new page, sort
  // or filter), so the arrival animation plays then - not on every
  // background refetch of the same page.
  const setKey = products.map((p) => p.id).join(',');

  return (
    <div key={setKey}>
      {/* Table layout from the md breakpoint up */}
      <div className="hidden overflow-hidden rounded-2xl border border-line bg-surface md:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-paper/60 text-sm text-slate">
              <th scope="col" className="py-3 pr-4 pl-5 font-semibold">
                Item
              </th>
              <th scope="col" className="py-3 pr-4 font-semibold">
                Category
              </th>
              <th scope="col" className="py-3 pr-5 text-right font-semibold">
                Stock
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, i) => (
              <tr
                key={p.id}
                style={{ '--i': i } as CSSProperties}
                className="row-in group relative border-b border-line transition-colors last:border-0 hover:bg-lagoon-bg/50 focus-within:bg-lagoon-bg/50"
              >
                <td className="py-3.5 pr-4 pl-5">
                  {/* The link covers the whole row (via the ::after), so the
                      row is one large target on a tablet, but there is still
                      only one focusable element per item. */}
                  <Link
                    to={`/items/${p.id}`}
                    state={listState}
                    className="font-semibold text-ink after:absolute after:inset-0 after:content-[''] group-hover:text-lagoon-deep"
                  >
                    {p.title}
                  </Link>
                  {p.brand && (
                    <span className="block text-sm text-slate">{p.brand}</span>
                  )}
                </td>
                <td className="py-3.5 pr-4">
                  <CategoryTag category={p.category} />
                </td>
                <td className="py-3.5 pr-5">
                  <div className="flex items-center justify-end gap-3">
                    <StockFigure stock={p.stock} index={i} />
                    <ChevronRight className="h-5 w-5 text-slate/50 transition-transform group-hover:translate-x-0.5 group-hover:text-lagoon" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stacked cards below md - no horizontal scroll at 360px */}
      <ul className="flex flex-col gap-2.5 md:hidden">
        {products.map((p, i) => (
          <li key={p.id} style={{ '--i': i } as CSSProperties} className="row-in">
            <Link
              to={`/items/${p.id}`}
              state={listState}
              className="press flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 active:border-lagoon active:bg-lagoon-bg/40"
            >
              <div className="min-w-0">
                <span className="block font-semibold text-ink">{p.title}</span>
                <span className="mt-1.5 block">
                  <CategoryTag category={p.category} />
                </span>
              </div>
              <StockFigure stock={p.stock} index={i} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Placeholder rows shaped like the table, shown on the first load only. */
export function StockTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading stock…</span>
      <div
        aria-hidden="true"
        className="flex flex-col gap-2.5 md:gap-0 md:overflow-hidden md:rounded-2xl md:border md:border-line md:bg-surface"
      >
        <div className="hidden h-11 border-b border-line bg-paper/60 md:block" />
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-4 md:rounded-none md:border-0 md:border-b md:px-5 md:last:border-0"
          >
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-3/5 max-w-xs" />
              <div className="skeleton h-3 w-24" />
            </div>
            <div className="skeleton hidden h-5 w-24 rounded-full md:block" />
            <div className="flex items-center gap-3">
              <div className="skeleton h-7 w-10" />
              <div className="skeleton h-9 w-3 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
