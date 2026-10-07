import { Link, useParams } from 'react-router-dom';
import { useStockItem } from '../hooks/useStock';
import { ApiError } from '../api/types';
import { ErrorState, EmptyState } from '../components/DataState';
import { StockCorrectionForm } from '../components/StockCorrectionForm';
import { StockFigure } from '../components/StockBadge';
import { ChevronLeft } from '../components/Icons';

const priceFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

function BackLink() {
  return (
    <Link
      to="/"
      className="group mb-3 inline-flex min-h-11 items-center gap-1 rounded-lg font-semibold text-lagoon hover:text-lagoon-deep"
    >
      <ChevronLeft className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" />
      Stock list
    </Link>
  );
}

function DetailSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading item…</span>
      <div aria-hidden="true" className="space-y-6">
        <div className="flex items-start justify-between gap-6 rounded-2xl border border-line bg-surface p-6">
          <div className="flex-1 space-y-3">
            <div className="skeleton h-5 w-24 rounded-full" />
            <div className="skeleton h-8 w-2/3" />
          </div>
          <div className="skeleton h-20 w-24" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="skeleton aspect-[4/3] rounded-2xl" />
          <div className="skeleton h-72 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export function ItemDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const isValidId = Number.isInteger(id) && id > 0;
  const query = useStockItem(id);
  const notFound = query.error instanceof ApiError && query.error.status === 404;

  if (!isValidId) {
    return (
      <div>
        <BackLink />
        <EmptyState
          title="Invalid item link"
          description="That item link isn't valid. Go back to the list and pick an item."
        />
      </div>
    );
  }

  return (
    <div>
      <BackLink />

      {query.isPending && <DetailSkeleton />}

      {notFound && (
        <EmptyState
          title="Item not found"
          description="No stock item has this ID. It may have been removed, or the link may be incomplete."
        />
      )}

      {query.isError && !notFound && !query.data && (
        <ErrorState
          message="Couldn't load this item. Check your connection."
          onRetry={() => query.refetch()}
        />
      )}

      {query.data && (
        <div>
          <section className="mb-6 flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div className="min-w-0">
              <span className="inline-block rounded-full bg-lagoon-bg px-2.5 py-0.5 text-xs font-semibold text-lagoon-deep capitalize">
                {query.data.category.replace(/-/g, ' ')}
              </span>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                {query.data.title}
              </h1>
              {query.data.brand && (
                <p className="mt-1 text-slate">{query.data.brand}</p>
              )}
            </div>
            <div className="self-end sm:self-auto">
              <StockFigure stock={query.data.stock} size="lg" />
            </div>
          </section>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="min-w-0 space-y-5">
              <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                <img
                  src={query.data.thumbnail}
                  alt=""
                  width={400}
                  height={300}
                  decoding="async"
                  className="aspect-[4/3] h-auto w-full max-w-full object-contain p-4"
                />
              </div>
              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line">
                <div className="bg-surface p-4">
                  <dt className="text-sm text-slate">Unit price</dt>
                  <dd className="stock-figure mt-0.5 text-lg font-bold text-ink">
                    {priceFormat.format(query.data.price)}
                  </dd>
                </div>
                <div className="bg-surface p-4">
                  <dt className="text-sm text-slate">Item ID</dt>
                  <dd className="stock-figure mt-0.5 text-lg font-bold text-ink">
                    {query.data.id}
                  </dd>
                </div>
              </dl>
              {query.data.description && (
                <p className="leading-relaxed text-slate">{query.data.description}</p>
              )}
            </div>

            <div>
              <StockCorrectionForm
                productId={query.data.id}
                currentStock={query.data.stock}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
