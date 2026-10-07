import { Link, Routes, Route } from 'react-router-dom';
import { AuthGuard } from './routes/AuthGuard';
import { AppShell } from './components/AppShell';
import { LoginPage } from './pages/LoginPage';
import { StockListPage } from './pages/StockListPage';
import { ItemDetailPage } from './pages/ItemDetailPage';
import { VialMark } from './components/Icons';

function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <VialMark className="h-10 w-10 text-ink" />
      <h1 className="text-2xl font-bold text-ink">Page not found</h1>
      <p className="max-w-sm text-slate">
        This link doesn't match any page in the stock console.
      </p>
      <Link
        to="/"
        className="press mt-2 inline-flex h-12 items-center rounded-xl bg-lagoon px-5 font-semibold text-white hover:bg-lagoon-deep"
      >
        Go to the stock list
      </Link>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* One shared, persistent layout for every signed-in page. */}
      <Route
        element={
          <AuthGuard>
            <AppShell />
          </AuthGuard>
        }
      >
        <Route index element={<StockListPage />} />
        <Route path="items/:id" element={<ItemDetailPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
