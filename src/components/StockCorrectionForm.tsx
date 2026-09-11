import { useState, type FormEvent } from 'react';
import { useUpdateStock } from '../hooks/useStock';

export function StockCorrectionForm({
  productId,
  currentStock,
}: {
  productId: number;
  currentStock: number;
}) {
  const [value, setValue] = useState(String(currentStock));
  const [validationError, setValidationError] = useState<string | null>(null);
  const mutation = useUpdateStock(productId);

  // Keep the field in sync if the underlying value changes from elsewhere
  // (a background refetch), but never clobber an in-progress edit. Done
  // during render against the last-seen value held in state - same pattern
  // as SearchBox, and safe under the React Compiler unlike a ref read.
  const [lastStock, setLastStock] = useState(currentStock);
  if (lastStock !== currentStock) {
    setLastStock(currentStock);
    if (!mutation.isPending) setValue(String(currentStock));
  }

  const parsed = Number(value);
  const isUnchanged = parsed === currentStock;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!Number.isInteger(parsed) || parsed < 0) {
      setValidationError('Enter a whole number of 0 or more.');
      return;
    }
    setValidationError(null);
    mutation.mutate(parsed);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-line bg-surface p-4"
    >
      <h2 className="mb-1 font-medium text-ink">Correct the count</h2>
      <p className="mb-3 text-sm text-slate">
        Enter what you counted on the shelf. This replaces the recorded figure.
      </p>

      <label htmlFor="stock-count" className="mb-1 block text-sm font-medium text-ink">
        Physical stock count
      </label>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="flex-1">
          <input
            id="stock-count"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-describedby={validationError ? 'stock-count-error' : undefined}
            aria-invalid={validationError ? true : undefined}
            className="stock-figure w-full rounded-md border border-line px-3 py-2 text-lg font-semibold text-ink"
          />
          {validationError && (
            <p id="stock-count-error" role="alert" className="mt-1 text-sm text-red">
              {validationError}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={mutation.isPending || isUnchanged}
          className="rounded-md bg-teal px-4 py-2 font-medium text-white transition-colors hover:bg-teal-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mutation.isPending ? 'Saving…' : 'Save count'}
        </button>
      </div>

      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm">
        {mutation.isPending && (
          <span className="text-amber">Saving your correction…</span>
        )}
        {mutation.isSuccess && !mutation.isPending && (
          <span className="text-green">
            Count saved. The list now shows {currentStock}.
          </span>
        )}
        {mutation.isError && (
          <span className="text-red">
            Couldn&apos;t save — the count is unchanged. Check your connection and try
            again.
          </span>
        )}
      </p>
    </form>
  );
}
