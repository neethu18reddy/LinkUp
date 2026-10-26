import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useAuth } from '@/store/auth';
import { refreshSession } from './auth.client';
import { SessionBoundary } from './SessionBoundary';

vi.mock('./auth.client', () => ({ refreshSession: vi.fn(), clearLocalSession: vi.fn() }));
beforeEach(() => {
  useAuth.getState().clearSession();
  vi.clearAllMocks();
});
const user = {
  id: 'c08b8c88-e1a7-4ee9-9760-f2ade72183dc',
  name: 'Learner',
  email: 'learner@example.test',
  role: 'USER' as const,
  createdAt: new Date().toISOString(),
};
function OwnedQuery() {
  const result = useQuery({
    queryKey: ['owned-profile', user.id],
    queryFn: async () => 'New account data',
  });
  return <p>{result.data ?? 'Loading profile'}</p>;
}
function Content() {
  const signedIn = useAuth((state) => !!state.user);
  return signedIn ? <OwnedQuery /> : <p>Restoring session</p>;
}
it('clears the previous account cache before the restored account mounts its queries', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  client.setQueryData(['old-private-data'], 'Previous account');
  vi.mocked(refreshSession).mockImplementation(async () => {
    await Promise.resolve();
    useAuth.getState().setSession(user, 'token');
    return 'token';
  });
  render(
    <QueryClientProvider client={client}>
      <SessionBoundary>
        <Content />
      </SessionBoundary>
    </QueryClientProvider>,
  );
  expect(await screen.findByText('New account data')).toBeInTheDocument();
  expect(client.getQueryData(['old-private-data'])).toBeUndefined();
});
