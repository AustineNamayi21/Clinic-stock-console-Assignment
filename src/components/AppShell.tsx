import { useEffect, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useIsFetching } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { VialMark } from './Icons';

function initials(firstName?: string, lastName?: string, username?: string) {
  const fromName = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`;
  return (fromName || username?.slice(0, 2) || '?').toUpperCase();
}

/**
 * Layout for every signed-in screen. It stays mounted while the user moves
 * between pages, so the header doesn't flash or re-render on navigation.
 */
export function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const lastPathRef = useRef<string | null>(null);
  const isFetching = useIsFetching() > 0;

  // Move focus to the main region when the route actually changes, so
  // keyboard and screen reader users aren't left with focus on a
  // now-unmounted element. Guarded against re-running on every render:
  // without the path comparison, any unrelated re-render (a query
  // refetch, a state update) would steal focus back from whatever the
  // user had tabbed to, trapping them on <main>.
  useEffect(() => {
    if (lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [pathname]);

  function handleSignOut() {
    signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-lagoon focus:px-4 focus:py-2 focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>

      <header className="on-black sticky top-0 z-30 bg-black text-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            to="/"
            className="flex min-h-11 items-center gap-2.5 rounded-lg text-lg font-bold tracking-tight"
          >
            <VialMark className="h-7 w-7 text-white" />
            <span>
              Clinic Stock
              <span className="hidden text-on-black-muted sm:inline"> Console</span>
            </span>
          </Link>

          {user && (
            <div className="flex items-center gap-3">
              <span className="hidden items-center gap-2.5 sm:flex">
                <span
                  aria-hidden="true"
                  className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-blue to-leaf text-sm font-bold"
                >
                  {initials(user.firstName, user.lastName, user.username)}
                </span>
                <span className="text-sm text-on-black-muted">{user.username}</span>
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                className="press h-11 rounded-xl border border-white/25 px-4 text-sm font-semibold text-white hover:border-aqua hover:text-aqua"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
        {/* Flows while any request is in flight. Purely visual: loading is
            announced by the status regions in the content itself. */}
        <div className="flow-line" data-active={isFetching} aria-hidden="true" />
      </header>

      <main
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
        className="mx-auto max-w-6xl px-4 pt-6 pb-16 focus:outline-none sm:px-6 sm:pt-8"
      >
        <div key={pathname} className="page-enter">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
