import { API_BASE } from './config';
import { ApiError } from './types';

interface RequestOptions extends RequestInit {
  /** Skip the Authorization header (login itself doesn't have a token yet). */
  skipAuth?: boolean;
}

export interface ApiClient {
  fetch: <T>(path: string, options?: RequestOptions) => Promise<T>;
}

/**
 * Builds a small typed client. `getAccessToken` must return the *current*
 * token at call time (not a value captured when the client was created),
 * because a refresh can happen while a request is in flight.
 *
 * A 401 is handled in one of two ways:
 * - If the token has already changed since this request was sent (another
 *   request refreshed it in the meantime), retry once with the current
 *   token - no second refresh needed.
 * - Otherwise trigger a refresh (the auth context de-dupes concurrent
 *   refreshes) and retry once with the token that refresh returned.
 *
 * A 401 on the retry is a real auth failure and is surfaced as such.
 */
export function createApiClient(
  getAccessToken: () => string | null,
  refreshAccessToken: () => Promise<string>,
): ApiClient {
  async function doFetch<T>(
    path: string,
    options: RequestOptions = {},
    retryToken?: string,
  ): Promise<T> {
    const { skipAuth, headers, ...rest } = options;
    const token = retryToken ?? getAccessToken();

    const res = await fetch(`${API_BASE}${path}`, {
      ...rest,
      headers: {
        ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
        ...(!skipAuth && token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });

    if (res.status === 401 && !skipAuth && retryToken === undefined) {
      const current = getAccessToken();
      if (current && current !== token) {
        return doFetch<T>(path, options, current);
      }

      let fresh: string;
      try {
        fresh = await refreshAccessToken();
      } catch (err) {
        // The API rejected the refresh: the session is over (the auth
        // context has already cleared it). Anything else - typically a
        // network failure - is rethrown as-is so it reads as a connection
        // problem, not a sign-out.
        if (err instanceof ApiError) throw new ApiError('Session expired', 401);
        throw err;
      }
      return doFetch<T>(path, options, fresh);
    }

    if (!res.ok) {
      throw new ApiError(`Request failed (${res.status})`, res.status);
    }

    return res.json() as Promise<T>;
  }

  return { fetch: doFetch };
}
