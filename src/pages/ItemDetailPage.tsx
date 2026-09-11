import { Link, useParams } from 'react-router-dom';
import { useStockItem } from '../hooks/useStock';
import { LoadingState, ErrorState, EmptyState } from '../components/DataState';
import { StockCorrectionForm } from '../components/StockCorrectionForm';
import { StockFigure } from '../components/StockBadge';

export function ItemDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const isValidId = Number.isInteger(id) && id > 0;
  const query = useStockItem(id);

  return (
    <div>
      <Link to="/" className="mb-4 inline-block text-sm text-teal hover:underline">
        &larr; Back to stock list
      </Link>

      {!isValidId && (
        <EmptyState
          title="Invalid item link"
          description="That item link isn't valid. Go back to the list and pick an item."
        />
      )}

      {isValidId && query.isPending && <LoadingState label="Loading item…" />}

      {isValidId && query.isError && (
        <ErrorState
          message="Couldn't load this item."
          onRetry={() => query.refetch()}
        />
      )}

      {isValidId && query.isSuccess && (
        <div className="fade-in">
          <div className="mb-6 flex items-start justify-between gap-6 border-b border-line pb-6">
            <div className="min-w-0">
              <p className="text-sm text-slate">
                {query.data.category.replace(/-/g, ' ')}
              </p>
              <h1 className="text-xl font-semibold text-ink">{query.data.title}</h1>
              {query.data.brand && (
                <p className="mt-1 text-sm text-slate">{query.data.brand}</p>
              )}
            </div>
            <StockFigure stock={query.data.stock} size="lg" />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <img
                src={query.data.thumbnail}
                alt=""
                className="w-full rounded-lg border border-line bg-surface"
              />
              <p className="mt-3 text-sm text-slate">{query.data.description}</p>
            </div>

            <StockCorrectionForm
              productId={query.data.id}
              currentStock={query.data.stock}
            />
          </div>
        </div>
      )}
    </div>
  );
}
