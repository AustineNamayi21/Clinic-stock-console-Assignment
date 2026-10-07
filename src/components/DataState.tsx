import type { ReactNode } from 'react';

export function LoadingState({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 py-12 text-slate"
    >
      <span
        className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-teal"
        aria-hidden="true"
      />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line py-16 text-center"
    >
      <p className="font-medium text-ink">{title}</p>
      {description && <p className="max-w-sm text-sm text-slate">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex flex-col items-center gap-3 rounded-lg border border-red-bg bg-red-bg py-12 text-center"
    >
      <p className="flex items-center gap-2 font-medium text-red">
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-5 w-5 shrink-0"
        >
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md border border-red px-4 py-2 text-sm font-medium text-red hover:bg-white"
      >
        Try again
      </button>
    </div>
  );
}
