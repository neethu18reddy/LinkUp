import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { getCertificates, issueCertificate } from '@/features/certificates/certificates.api';
import { CertificatesPage } from './CertificatesPage';
import { AxiosError } from 'axios';
vi.mock('@/features/certificates/certificates.api', () => ({
  getCertificates: vi.fn(),
  issueCertificate: vi.fn(),
  downloadCertificate: vi.fn(),
}));
describe('certificates page', () => {
  it('hides stale certificate validity when refreshing the inbox fails', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['certificates'], {
      roadmaps: [],
      certificates: [
        {
          id: 'certificate',
          recipientName: 'Learner',
          roleTitle: 'Developer',
          completedHours: 10,
          issuedAt: '2026-10-27T00:00:00.000Z',
          verificationCode: 'a'.repeat(64),
          verificationUrl: 'https://example.test',
          status: 'VALID',
        },
      ],
    });
    vi.mocked(getCertificates).mockRejectedValueOnce(new AxiosError('offline'));
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <CertificatesPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('alert', {}, { timeout: 5000 })).toHaveTextContent(
      'We couldn’t reach the server.',
    );
    expect(screen.queryByText('Valid')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download PDF' })).not.toBeInTheDocument();
  });
  it('requires public-name acknowledgement before issuing an eligible certificate', async () => {
    vi.mocked(getCertificates).mockResolvedValue({
      certificates: [],
      roadmaps: [
        {
          id: 'roadmap',
          title: 'Ready path',
          eligible: true,
          remainingTopics: 0,
          missingProjects: 0,
          certificateId: null,
        },
      ],
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <CertificatesPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const button = await screen.findByRole(
      'button',
      { name: 'Issue certificate' },
      { timeout: 5000 },
    );
    expect(button).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox'));
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(issueCertificate).toHaveBeenCalledWith('roadmap', expect.anything());
  });
});
