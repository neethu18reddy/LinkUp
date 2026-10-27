import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { RouteErrorBoundary } from './RouteErrorBoundary';
const silenceExpectedError = (event: ErrorEvent) => {
  if (event.error instanceof Error && event.error.message === 'private server details')
    event.preventDefault();
};
afterEach(() => {
  vi.restoreAllMocks();
  window.removeEventListener('error', silenceExpectedError);
});
function BrokenPage() {
  const { pathname } = useLocation();
  if (pathname === '/broken') throw new Error('private server details');
  return <p>Home restored</p>;
}
it('shows recovery controls without leaking errors and recovers on navigation', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  window.addEventListener('error', silenceExpectedError);
  render(
    <MemoryRouter initialEntries={['/broken']}>
      <RouteErrorBoundary>
        <BrokenPage />
      </RouteErrorBoundary>
    </MemoryRouter>,
  );
  expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t load this page.');
  expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
  expect(screen.queryByText('private server details')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('link', { name: 'Return home' }));
  expect(screen.getByText('Home restored')).toBeInTheDocument();
});
