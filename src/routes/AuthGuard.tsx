import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { LoadingState } from '../components/DataState';

/** Only allows internal, relative paths in returnTo to avoid an open redirect. */
function buildReturnTo(pathname: string, search: string): string {
  const path = `${pathname}${search}`;
  return path.startsWith('/') && !path.startsWith('//') ? path : '/';
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isRestoring } = useAuth();
  const location = useLocation();

  if (isRestoring) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState label="Restoring your session…" />
      </div>
    );
  }

  if (!user) {
    const returnTo = buildReturnTo(location.pathname, location.search);
    return (
      <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />
    );
  }

  return <>{children}</>;
}