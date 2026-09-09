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
      <p className="font-medium text-red">{message}</p>
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
