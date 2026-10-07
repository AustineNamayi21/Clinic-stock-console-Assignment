import { useState, type FormEvent } from 'react';
import { useUpdateStock } from '../hooks/useStock';
import { CheckIcon, Spinner } from './Icons';

const STEP_BUTTON =
  'press grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-line bg-surface text-2xl font-bold text-ink hover:border-lagoon hover:text-lagoon-deep disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink';

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
  const isWholeNumber = value.trim() !== '' && Number.isInteger(parsed);

  function adjust(delta: number) {
    const base = isWholeNumber ? parsed : currentStock;
    setValue(String(Math.max(0, base + delta)));
    setValidationError(null);
    if (!mutation.isPending) mutation.reset();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isWholeNumber || parsed < 0) {
      setValidationError('Enter a whole number of 0 or more.');
      return;
    }
    setValidationError(null);
    mutation.mutate(parsed);
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-2xl border border-line bg-surface p-5 sm:p-7"
    >
      <h2 className="text-xl font-bold text-ink">Correct the count</h2>
      <p className="mt-1 mb-5 text-slate">
        Enter what you counted on the shelf. This replaces the recorded figure.
      </p>

      <label htmlFor="stock-count" className="mb-2 block font-semibold text-ink">
        Physical stock count
      </label>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => adjust(-1)}
          disabled={mutation.isPending || (isWholeNumber && parsed <= 0)}
          className={STEP_BUTTON}
          aria-label="Decrease count by 1"
        >
          −
        </button>
        <input
          id="stock-count"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (!mutation.isPending) mutation.reset();
          }}
          aria-describedby={validationError ? 'stock-count-error' : undefined}
          aria-invalid={validationError ? true : undefined}
          className="stock-figure no-spin h-14 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-center text-2xl font-bold text-ink transition-colors focus:border-lagoon aria-[invalid=true]:border-red"
        />
        <button
          type="button"
          onClick={() => adjust(1)}
          disabled={mutation.isPending}
          className={STEP_BUTTON}
          aria-label="Increase count by 1"
        >
          +
        </button>
      </div>

      {validationError && (
        <p id="stock-count-error" role="alert" className="mt-2 font-medium text-red">
          {validationError}
        </p>
      )}

      <button
        type="submit"
        disabled={mutation.isPending || isUnchanged}
        className="press mt-5 inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-lagoon px-5 text-lg font-bold text-white shadow-[0_6px_20px_-8px] shadow-lagoon/60 hover:bg-lagoon-deep disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
      >
        {mutation.isPending && <Spinner className="h-5 w-5" />}
        {mutation.isPending ? 'Saving…' : 'Save count'}
      </button>

      <p role="status" aria-live="polite" className="mt-4 min-h-6">
        {mutation.isPending && (
          <span className="font-medium text-slate">Saving your correction…</span>
        )}
        {mutation.isSuccess && !mutation.isPending && (
          <span className="flex items-center gap-2 font-semibold text-green">
            <CheckIcon className="h-6 w-6 shrink-0" />
            Count saved. The list now shows {currentStock}.
          </span>
        )}
        {mutation.isError && (
          <span className="font-semibold text-red">
            Couldn&apos;t save. The count is unchanged. Check your connection and try
            again.
          </span>
        )}
      </p>
    </form>
  );
}
