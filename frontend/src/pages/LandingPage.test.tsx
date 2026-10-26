import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { getHealth } from '@/lib/api';
import { LandingPage } from './LandingPage';

vi.mock('@/lib/api', () => ({ getHealth: vi.fn() }));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <LandingPage />
    </QueryClientProvider>,
  );
}

describe('landing API connection states', () => {
  it('shows a connection state while the server request is pending', () => {
    vi.mocked(getHealth).mockImplementation(() => new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('Connecting to server');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Your next chapter');
  });

  it('shows a successful connection', async () => {
    vi.mocked(getHealth).mockResolvedValue({
      name: 'linkup',
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
    renderPage();
    expect(await screen.findByText('Server is running')).toBeInTheDocument();
  });

  it('allows retry after a failed request', async () => {
    vi.mocked(getHealth).mockRejectedValue(new Error('Offline'));
    renderPage();
    expect(await screen.findByText('Server is unavailable')).toBeInTheDocument();
    vi.mocked(getHealth).mockResolvedValue({
      name: 'linkup',
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Server is running')).toBeInTheDocument();
  });
});
