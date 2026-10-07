import { ApiError } from './types';

/**
 * Says what went wrong when data couldn't load, in terms the user can act
 * on: a server failure (try again shortly) reads differently from no
 * connection (check the network).
 */
export function describeLoadError(error: unknown, what: string): string {
  if (error instanceof ApiError && error.status >= 500) {
    return `Couldn't load ${what}: the stock service returned an error (${error.status}). Try again in a moment.`;
  }
  if (error instanceof ApiError) {
    return `Couldn't load ${what} (error ${error.status}).`;
  }
  return `Couldn't load ${what}. Check your connection and try again.`;
}
