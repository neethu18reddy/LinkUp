import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { TaskControl } from './TaskControl';
import { updateTask } from './progress.api';
vi.mock('./progress.api', async (original) => ({
  ...(await original<typeof import('./progress.api')>()),
  updateTask: vi.fn(),
}));
it('refreshes certificate validity when completed coursework is reopened', async () => {
  let validity = 'VALID';
  vi.mocked(updateTask).mockImplementation(async () => {
    validity = 'INACTIVE';
    return {};
  });
  function CertificateStatus() {
    const certificate = useQuery({ queryKey: ['certificates'], queryFn: async () => validity });
    const verification = useQuery({
      queryKey: ['certificate-verification', 'code'],
      queryFn: async () => validity,
    });
    return (
      <>
        <p>Certificate: {certificate.data}</p>
        <p>Verification: {verification.data}</p>
      </>
    );
  }
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30000 } } })}
    >
      <MemoryRouter>
        <TaskControl id="task" title="Project" status="DONE" />
        <CertificateStatus />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(await screen.findByText('Certificate: VALID', {}, { timeout: 5000 })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('checkbox', { name: 'Complete Project' }));
  expect(await screen.findByText('Certificate: INACTIVE')).toBeInTheDocument();
  expect(await screen.findByText('Verification: INACTIVE')).toBeInTheDocument();
  expect(updateTask).toHaveBeenCalledWith(
    { id: 'task', status: 'TODO', expectedStatus: 'DONE' },
    expect.anything(),
  );
});
