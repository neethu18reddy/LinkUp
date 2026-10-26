import { Link, Route, Routes } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProtectedRoute } from './routes/ProtectedRoute';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<AuthPage key="login" mode="login" />} />
      <Route path="/register" element={<AuthPage key="register" mode="register" />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardPage />} />
      </Route>
      <Route
        path="*"
        element={
          <main className="error-page">
            <p className="eyebrow">404</p>
            <h1>This page isn’t here yet.</h1>
            <Link className="text-link" to="/">
              Back to linkup
            </Link>
          </main>
        }
      />
    </Routes>
  );
}
