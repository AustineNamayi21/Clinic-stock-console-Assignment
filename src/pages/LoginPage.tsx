import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/types';
import { AlertIcon, Spinner, VialMark } from '../components/Icons';

/** Only internal, relative paths are honoured, to avoid an open redirect. */
function safeReturnTo(raw: string | null): string {
  if (!raw) return '/';
  return raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
}

export function LoginPage() {
  const { user, isRestoring, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get('returnTo'));

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isRestoring && user) {
    return <Navigate to={returnTo} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await signIn(username, password);
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Something went wrong. Try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const fieldClass =
    'h-12 w-full rounded-xl border border-line bg-surface px-3.5 text-base text-ink transition-colors hover:border-slate/40 focus:border-lagoon';

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <section className="on-black relative isolate overflow-hidden bg-black px-6 py-8 text-white sm:px-10 lg:flex lg:flex-col lg:justify-between lg:py-12">
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <span className="glow glow-a -top-24 -left-20 h-80 w-80" />
          <span className="glow glow-b -right-24 -bottom-32 h-96 w-96" />
        </div>

        <div className="flex items-center gap-2.5 text-lg font-bold tracking-tight">
          <VialMark className="h-8 w-8 text-white" />
          Clinic Stock Console
        </div>

        <div className="mt-8 max-w-md lg:mt-0">
          <p className="text-3xl leading-[1.1] font-extrabold tracking-tight sm:text-4xl lg:text-6xl">
            Know what&apos;s on the shelf.
          </p>
          <p className="mt-4 hidden text-lg text-on-black-muted sm:block">
            Search the supplies catalogue, see what&apos;s running low and correct a
            count after a shelf check. Links keep your place, so you can share them.
          </p>
        </div>

        <div className="mt-8 hidden h-1 w-40 rounded-full bg-gradient-to-r from-blue via-aqua to-leaf lg:block" />
      </section>

      <div className="flex items-start justify-center px-4 py-10 sm:px-6 lg:items-center">
        <div className="page-enter w-full max-w-sm">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Sign in</h1>
          <p className="mt-1 mb-7 text-slate">Use your clinic account to continue.</p>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="username" className="mb-1.5 block font-semibold text-ink">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block font-semibold text-ink">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={fieldClass}
              />
            </div>

            {error && (
              <p
                role="alert"
                className="flex items-center gap-2 rounded-xl bg-red-bg px-3.5 py-2.5 font-medium text-red"
              >
                <AlertIcon className="h-5 w-5 shrink-0" />
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="press inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-lagoon px-4 text-base font-bold text-white shadow-[0_6px_20px_-8px] shadow-lagoon/60 hover:bg-lagoon-deep disabled:opacity-60"
            >
              {isSubmitting && <Spinner className="h-5 w-5" />}
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-7 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-slate">
            Test account: <span className="font-bold text-ink">emilys</span> /{' '}
            <span className="font-bold text-ink">emilyspass</span>
          </p>
        </div>
      </div>
    </div>
  );
}
