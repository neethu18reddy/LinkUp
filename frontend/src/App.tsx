import { Link, Route, Routes } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { SkillsPage } from './pages/SkillsPage';
const GoalsPage = lazy(() =>
  import('./pages/GoalsPage').then((module) => ({ default: module.GoalsPage })),
);
const RoadmapPage = lazy(() =>
  import('./pages/RoadmapPage').then((module) => ({ default: module.RoadmapPage })),
);
const PlanPage = lazy(() =>
  import('./pages/PlanPage').then((module) => ({ default: module.PlanPage })),
);
const ProgressPage = lazy(() =>
  import('./pages/ProgressPage').then((module) => ({ default: module.ProgressPage })),
);
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })),
);
const ChatPage = lazy(() =>
  import('./pages/ChatPage').then((module) => ({ default: module.ChatPage })),
);

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<AuthPage key="login" mode="login" />} />
      <Route path="/register" element={<AuthPage key="register" mode="register" />} />
      <Route element={<ProtectedRoute />}>
        <Route
          path="/dashboard"
          element={
            <Suspense fallback={<main role="status">Loading your dashboard…</main>}>
              <DashboardPage />
            </Suspense>
          }
        />
        <Route path="/skills" element={<SkillsPage />} />
        <Route
          path="/mentor"
          element={
            <Suspense fallback={<main role="status">Loading your mentor…</main>}>
              <ChatPage />
            </Suspense>
          }
        />
        <Route
          path="/progress"
          element={
            <Suspense fallback={<main role="status">Loading learning history…</main>}>
              <ProgressPage />
            </Suspense>
          }
        />
        <Route
          path="/plan"
          element={
            <Suspense fallback={<main role="status">Loading your plan…</main>}>
              <PlanPage />
            </Suspense>
          }
        />
        <Route
          path="/roadmap"
          element={
            <Suspense fallback={<main role="status">Loading your roadmap…</main>}>
              <RoadmapPage />
            </Suspense>
          }
        />
        <Route
          path="/goals"
          element={
            <Suspense
              fallback={
                <main className="session-screen" role="status">
                  Loading your goal page…
                </main>
              }
            >
              <GoalsPage />
            </Suspense>
          }
        />
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
