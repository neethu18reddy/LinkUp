import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AxiosError } from 'axios';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { verifyCertificate } from '@/features/certificates/certificates.api';
import { VerifyPage } from './VerifyPage';
vi.mock('@/features/certificates/certificates.api', () => ({ verifyCertificate: vi.fn() }));
const code = 'a'.repeat(64);
const certificate = {
  id: '12345678-1234-4234-8234-123456789012',
  recipientName: 'Sample Learner',
  roleTitle: 'Developer',
  completedHours: 12,
  issuedAt: '2026-10-27T00:00:00.000Z',
  verificationCode: code,
  verificationUrl: `http://localhost:5173/verify/${code}`,
  status: 'VALID' as const,
};
function mount(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/verify/${code}`]}>
        <Routes>
          <Route path="/verify/:code" element={<VerifyPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}
beforeEach(() => vi.resetAllMocks());
describe('public verification recovery', () => {
  it('shows loading, then allows a failed connection to retry successfully without login', async () => {
    vi.mocked(verifyCertificate)
      .mockRejectedValueOnce(new AxiosError('offline'))
      .mockResolvedValue(certificate);
    mount();
    expect(screen.getByRole('status')).toHaveTextContent('Checking certificate');
    await userEvent.click(
      await screen.findByRole('button', { name: 'Retry verification' }, { timeout: 5000 }),
    );
    expect(await screen.findByText('Verified completion')).toBeInTheDocument();
    expect(verifyCertificate).toHaveBeenCalledWith(code);
  });
  it('does not present cached validity after a refresh fails', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['certificate-verification', code], certificate);
    vi.mocked(verifyCertificate).mockRejectedValue(new AxiosError('offline'));
    mount(client);
    expect(
      await screen.findByText('Verification is unavailable', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Verified completion')).not.toBeInTheDocument();
    expect(screen.queryByText('Sample Learner')).not.toBeInTheDocument();
  });
  it('explains invalid links and inactive certificates separately', async () => {
    const error = new AxiosError('missing');
    Object.assign(error, { response: { status: 404 } });
    vi.mocked(verifyCertificate)
      .mockRejectedValueOnce(error)
      .mockResolvedValue({ ...certificate, status: 'INACTIVE' });
    const client = mount();
    expect(
      await screen.findByText('Certificate not found', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry verification' })).not.toBeInTheDocument();
    await client.invalidateQueries({ queryKey: ['certificate-verification'] });
    await waitFor(() => expect(screen.getByText('Certificate inactive')).toBeInTheDocument());
  });
});
