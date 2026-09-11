import { useEffect, useRef, useState } from 'react';

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
    <div className="flex-1">
      <label htmlFor="stock-search" className="sr-only">
        Search stock by name
      </label>
      <input
        id="stock-search"
        type="search"
        placeholder="Search stock…"
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full rounded-md border border-line bg-surface px-3 py-2 text-ink placeholder:text-slate"
      />
      <span role="status" aria-live="polite" className="sr-only">
        {isPending ? `Searching for ${draft}` : ''}
      </span>
    </div>
  );
}
