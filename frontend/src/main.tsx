import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { MotionConfig } from 'framer-motion';
import '@fontsource-variable/dm-sans';
import { App } from './App';
import './index.css';
import './workspace.css';
import './design-system.css';
import { SessionBoundary } from './features/auth/SessionBoundary';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false } },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <SessionBoundary>
            <RouteErrorBoundary>
              <App />
            </RouteErrorBoundary>
          </SessionBoundary>
          <Toaster richColors position="bottom-right" />
        </BrowserRouter>
      </QueryClientProvider>
    </MotionConfig>
  </React.StrictMode>,
);
