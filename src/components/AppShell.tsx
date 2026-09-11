import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const lastPathRef = useRef<string | null>(null);

  // Move focus to the main region when the route actually changes, so
  // keyboard and screen reader users aren't left with focus on a
  // now-unmounted element. Guarded against re-running on every render:
  // without the path comparison, any unrelated re-render (a query
  // refetch, a state update) would steal focus back from whatever the
  // user had tabbed to, trapping them on <main>.
  useEffect(() => {
    if (lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;
    mainRef.current?.focus();
  }, [pathname]);

  function handleSignOut() {
    signOut();
    navigate('/login', { replace: true });
  }

  const skipLinkClasses = [
    'sr-only',
    'focus:not-sr-only',
    'focus:fixed',
    'focus:left-4',
    'focus:top-4',
    'focus:z-50',
    'focus:rounded-md',
    'focus:bg-teal',
    'focus:px-4',
    'focus:py-2',
    'focus:text-white',
  ].join(' ');

  return (
    <div className="min-h-screen">
      <a href="#main-content" className={skipLinkClasses}>
        Skip to content
      </a>

      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <span className="text-sm font-semibold tracking-tight text-ink">
            Clinic Stock Console
          </span>
          {user && (
            <div className="flex items-center gap-3 text-sm">
              <span className="hidden text-slate sm:inline">{user.username}</span>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-md border border-line px-3 py-1.5 font-medium text-ink transition-colors hover:bg-paper"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <main
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
        className="mx-auto max-w-5xl px-4 py-6 focus:outline-none sm:px-6"
      >
        {children}
      </main>
    </div>
  );
}
