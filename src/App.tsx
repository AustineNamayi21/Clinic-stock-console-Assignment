import { Routes, Route } from 'react-router-dom';
import { AuthGuard } from './routes/AuthGuard';
import { AppShell } from './components/AppShell';
import { LoginPage } from './pages/LoginPage';
import { StockListPage } from './pages/StockListPage';
import { ItemDetailPage } from './pages/ItemDetailPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <AuthGuard>
            <AppShell>
              <StockListPage />
            </AppShell>
          </AuthGuard>
        }
      />
      <Route
        path="/items/:id"
        element={
          <AuthGuard>
            <AppShell>
              <ItemDetailPage />
            </AppShell>
          </AuthGuard>
        }
      />
      <Route
        path="*"
        element={
          <div className="flex min-h-screen items-center justify-center text-slate">
            Page not found.
          </div>
        }
      />
    </Routes>
  );
}
