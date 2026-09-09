
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
 * Builds a small typed client bound to the current access token and a
 * refresh function. A 401 triggers exactly one refresh attempt (the auth
 * context de-dupes concurrent refreshes) and the original request is
 * retried once with the new token. A second 401 after that is a real
 * auth failure and is surfaced as such.
 */
export function createApiClient(
  getAccessToken: () => string | null,
  refreshAccessToken: () => Promise<string>,
): ApiClient {
  async function doFetch<T>(
    path: string,
    options: RequestOptions = {},
    isRetry = false,
  ): Promise<T> {
    const { skipAuth, headers, ...rest } = options;
    const token = getAccessToken();

    const res = await fetch(`${API_BASE}${path}`, {
      ...rest,
      headers: {
        ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
        ...(!skipAuth && token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });

    if (res.status === 401 && !skipAuth && !isRetry) {
      try {
        await refreshAccessToken();
      } catch {
        throw new ApiError('Session expired', 401);
      }
      return doFetch<T>(path, options, true);
    }

    if (!res.ok) {
      throw new ApiError(`Request failed (${res.status})`, res.status);
    }

    return res.json() as Promise<T>;
  }

  return { fetch: doFetch };
}