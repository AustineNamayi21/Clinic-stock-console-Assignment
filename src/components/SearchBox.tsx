import { useEffect, useRef, useState } from 'react';
import { SearchIcon, Spinner } from './Icons';

const DEBOUNCE_MS = 300;

export function SearchBox({
  committedValue,
  onCommit,
}: {
  committedValue: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(committedValue);
  const [isPending, setIsPending] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Re-sync the draft when the committed value changes for a reason other
  // than this component's own debounce commit (browser back/forward, or
  // opening a copied URL). Done during render against the last-seen value
  // held in state - React's documented pattern for adjusting state when a
  // prop changes, and cheaper than an effect (no extra render pass).
  const [lastCommitted, setLastCommitted] = useState(committedValue);
  if (lastCommitted !== committedValue) {
    setLastCommitted(committedValue);
    setDraft(committedValue);
    setIsPending(false);
  }

  function handleChange(value: string) {
    setDraft(value);
    setIsPending(value !== committedValue);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onCommit(value), DEBOUNCE_MS);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="relative flex-1">
      <label htmlFor="stock-search" className="sr-only">
        Search stock by name
      </label>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-slate" />
      <input
        id="stock-search"
        type="search"
        placeholder="Search stock…"
        autoComplete="off"
        enterKeyHint="search"
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        className="h-12 w-full rounded-xl border border-line bg-surface pr-3.5 pl-11 text-base text-ink transition-colors placeholder:text-slate hover:border-slate/40 focus:border-lagoon"
      />
      {isPending && (
        <span className="absolute top-1/2 right-3.5 -translate-y-1/2 text-lagoon">
          <Spinner />
        </span>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {isPending ? `Searching for ${draft}` : ''}
      </span>
    </div>
  );
}
