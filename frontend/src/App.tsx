import { Link, Route, Routes } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
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
