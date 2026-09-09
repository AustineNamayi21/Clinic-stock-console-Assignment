import { Routes, Route } from 'react-router-dom';
import { AuthGuard } from './routes/AuthGuard';
import { LoginPage } from './pages/LoginPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <AuthGuard>
            <div className="p-8">Stock list goes here</div>
          </AuthGuard>
        }
      />
      <Route
        path="/items/:id"
        element={
          <AuthGuard>
            <div className="p-8">Item detail goes here</div>
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
