import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { getCertificates, issueCertificate } from '@/features/certificates/certificates.api';
import { CertificatesPage } from './CertificatesPage';
vi.mock('@/features/certificates/certificates.api', () => ({
  getCertificates: vi.fn(),
  issueCertificate: vi.fn(),
  downloadCertificate: vi.fn(),
}));
describe('certificates page', () => {
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
