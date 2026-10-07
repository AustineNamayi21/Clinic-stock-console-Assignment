import { ApiError } from './types';

/**
 * Query retry policy: one automatic retry for network and server failures.
 * A 4xx (an item that doesn't exist, a rejected session) won't change on
 * retry, so it is shown straight away instead of after a wasted request.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  const clientError =
    error instanceof ApiError && error.status >= 400 && error.status < 500;
  return !clientError && failureCount < 1;
}
