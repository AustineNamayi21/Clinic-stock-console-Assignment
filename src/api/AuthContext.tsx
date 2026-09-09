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

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  /** True while the session is being restored from sessionStorage on first load. */
  isRestoring: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => void;
  /**
   * Attempts a refresh using the stored refresh token. Concurrent callers
   * (multiple queries 401-ing around the same time) share a single in-flight
   * promise rather than each firing their own /auth/refresh request.
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(hasStoredSession);
  const refreshPromiseRef = useRef<Promise<string> | null>(null);

  // Restore session from sessionStorage on mount, verifying the token is
  // still accepted by the API rather than trusting stale storage blindly.
  useEffect(() => {
    const storedAccess = sessionStorage.getItem(ACCESS_TOKEN_KEY);
    const storedUser = sessionStorage.getItem(USER_KEY);

    if (!storedAccess || !storedUser) {
      return;
    }

    let cancelled = false;

    fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${storedAccess}` },
    })
      .then((res) => {
        if (!res.ok) throw new ApiError('Session invalid', res.status);
        return res.json();
      })
      .then((freshUser: AuthUser) => {
        if (cancelled) return;
        setAccessToken(storedAccess);
        setUser(freshUser);
      })
      .catch(() => {
        sessionStorage.removeItem(ACCESS_TOKEN_KEY);
        sessionStorage.removeItem(REFRESH_TOKEN_KEY);
        sessionStorage.removeItem(USER_KEY);
      })
      .finally(() => {
        if (!cancelled) setIsRestoring(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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

    setAccessToken(at);
    setUser(authUser);
  }, []);

  const signOut = useCallback(() => {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem('csc:stockOverrides');
    setAccessToken(null);
    setUser(null);
  }, []);

  const refreshAccessToken = useCallback((): Promise<string> => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const promise = (async () => {
      const storedRefresh = sessionStorage.getItem(REFRESH_TOKEN_KEY);
      if (!storedRefresh) {
        throw new ApiError('No refresh token available', 401);
      }

      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: storedRefresh, expiresInMins: 1 }),
      });

      if (!res.ok) {
        throw new ApiError('Refresh failed', res.status);
      }

      const data: RefreshResponse = await res.json();
      sessionStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
      sessionStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
      setAccessToken(data.accessToken);
      return data.accessToken;
    })();

    refreshPromiseRef.current = promise;

    promise.finally(() => {
      refreshPromiseRef.current = null;
    });

    return promise;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      isRestoring,
      signIn,
      signOut,
      refreshAccessToken,
    }),
    [user, accessToken, isRestoring, signIn, signOut, refreshAccessToken],
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
}next 
