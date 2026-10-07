import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AuthUser, LoginResponse, RefreshResponse } from '../api/types';
import { ApiError } from '../api/types';
import { API_BASE } from '../api/config';

const ACCESS_TOKEN_KEY = 'csc:accessToken';
const REFRESH_TOKEN_KEY = 'csc:refreshToken';
const USER_KEY = 'csc:user';
const STOCK_OVERRIDES_KEY = 'csc:stockOverrides';

interface AuthContextValue {
  user: AuthUser | null;
  /** True while the session is being restored from sessionStorage on first load. */
  isRestoring: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => void;
  /**
   * Returns the current access token at call time. Read from a ref rather
   * than React state so a request that is already in flight when a refresh
   * completes sees the new token, not the one it was created with.
   */
  getAccessToken: () => string | null;
  /**
   * Attempts a refresh using the stored refresh token. Concurrent callers
   * (multiple queries 401-ing around the same time) share a single in-flight
   * promise rather than each firing their own /auth/refresh request.
   *
   * If the API rejects the refresh, the session is cleared, which makes
   * AuthGuard redirect to /login with a returnTo pointing back here. A
   * network failure does not clear the session - on patchy wifi that would
   * sign people out for losing signal.
   */
  refreshAccessToken: () => Promise<string>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Whether there's a stored session worth attempting to restore - computed
 * synchronously so the "nothing stored" case never needs a render pass
 * through a loading state. */
function hasStoredSession(): boolean {
  return Boolean(
    sessionStorage.getItem(ACCESS_TOKEN_KEY) && sessionStorage.getItem(USER_KEY),
  );
}

function readStoredUser(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function fetchMe(token: string): Promise<Response> {
  return fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isRestoring, setIsRestoring] = useState(hasStoredSession);
  const accessTokenRef = useRef<string | null>(null);
  const refreshPromiseRef = useRef<Promise<string> | null>(null);

  const getAccessToken = useCallback(() => accessTokenRef.current, []);

  /** Ends the session without touching stock overrides (used on expiry). */
  const clearSession = useCallback(() => {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    accessTokenRef.current = null;
    setUser(null);
  }, []);

  const refreshAccessToken = useCallback((): Promise<string> => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const promise = (async () => {
      const storedRefresh = sessionStorage.getItem(REFRESH_TOKEN_KEY);
      if (!storedRefresh) {
        clearSession();
        throw new ApiError('No refresh token available', 401);
      }

      // A network error here propagates as-is (not an ApiError) and leaves
      // the session in place.
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: storedRefresh, expiresInMins: 1 }),
      });

      if (!res.ok) {
        clearSession();
        throw new ApiError('Refresh failed', res.status);
      }

      const data: RefreshResponse = await res.json();
      sessionStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
      sessionStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
      accessTokenRef.current = data.accessToken;
      return data.accessToken;
    })();

    refreshPromiseRef.current = promise;

    // Clear the shared promise once it settles either way. Using then(f, f)
    // rather than finally() means this derived promise never rejects, so a
    // failed refresh doesn't also log an unhandled rejection.
    const clear = () => {
      if (refreshPromiseRef.current === promise) refreshPromiseRef.current = null;
    };
    promise.then(clear, clear);

    return promise;
  }, [clearSession]);

  // Restore session from sessionStorage on mount, verifying the token is
  // still accepted by the API rather than trusting stale storage blindly.
  // Access tokens only live for a minute, so an expired one is the normal
  // case on reload: try a refresh before giving up on the session.
  useEffect(() => {
    const storedAccess = sessionStorage.getItem(ACCESS_TOKEN_KEY);
    const storedUser = readStoredUser();

    if (!storedAccess || !storedUser) {
      return;
    }

    let cancelled = false;

    async function restore(token: string) {
      let res = await fetchMe(token);
      if (res.status === 401) {
        token = await refreshAccessToken();
        res = await fetchMe(token);
      }
      if (!res.ok) throw new ApiError('Session invalid', res.status);
      const freshUser: AuthUser = await res.json();
      return { token, freshUser };
    }

    restore(storedAccess)
      .then(({ token, freshUser }) => {
        if (cancelled) return;
        accessTokenRef.current = token;
        setUser(freshUser);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError) {
          // The API rejected the session - it's genuinely over.
          clearSession();
          return;
        }
        // Couldn't reach the API at all. Keep the user signed in with the
        // stored session; if the token turns out to be dead, the request
        // layer's refresh path will deal with it on the first real request.
        accessTokenRef.current = sessionStorage.getItem(ACCESS_TOKEN_KEY);
        setUser(storedUser);
      })
      .finally(() => {
        if (!cancelled) setIsRestoring(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshAccessToken, clearSession]);

  const signIn = useCallback(async (username: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // expiresInMins: 1 per the brief, to force real handling of
      // mid-session token expiry rather than leaving it untested.
      body: JSON.stringify({ username, password, expiresInMins: 1 }),
    });

    if (!res.ok) {
      throw new ApiError(
        res.status === 400 ? 'Invalid username or password' : 'Sign in failed',
        res.status,
      );
    }

    const data: LoginResponse = await res.json();
    const { accessToken: at, refreshToken: rt, ...authUser } = data;

    sessionStorage.setItem(ACCESS_TOKEN_KEY, at);
    sessionStorage.setItem(REFRESH_TOKEN_KEY, rt);
    sessionStorage.setItem(USER_KEY, JSON.stringify(authUser));

    accessTokenRef.current = at;
    setUser(authUser);
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    sessionStorage.removeItem(STOCK_OVERRIDES_KEY);
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isRestoring,
      signIn,
      signOut,
      getAccessToken,
      refreshAccessToken,
    }),
    [user, isRestoring, signIn, signOut, getAccessToken, refreshAccessToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Co-locating the provider and its hook is the standard context pattern;
// splitting into a second file for this alone would hurt readability more
// than it helps HMR.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
