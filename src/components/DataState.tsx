import type { ReactNode } from 'react';
import { AlertIcon, Spinner } from './Icons';

export function LoadingState({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 py-12 font-medium text-slate"
    >
      <Spinner className="h-5 w-5 text-lagoon" />
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
      className="page-enter flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line bg-surface px-6 py-16 text-center"
    >
      <span aria-hidden="true" className="vial mb-2 block h-12 w-5" data-level="out" />
      <p className="text-lg font-bold text-ink">{title}</p>
      {description && <p className="max-w-sm text-slate">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  retryLabel = 'Try again',
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="page-enter flex flex-col items-center gap-4 rounded-2xl border border-red/20 bg-red-bg px-6 py-12 text-center"
    >
      <p className="flex items-center gap-2 font-semibold text-red">
        <AlertIcon className="h-5 w-5 shrink-0" />
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="press h-11 rounded-xl border border-red/40 bg-surface px-5 font-semibold text-red hover:border-red"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
