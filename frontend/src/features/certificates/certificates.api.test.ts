import { afterEach, describe, it, expect, vi } from 'vitest';
import { api } from '@/lib/api';
import { getCertificates, verifyCertificate, issueCertificate } from './certificates.api';
afterEach(() => vi.restoreAllMocks());
const certificate = {
  id: '12345678-1234-4234-8234-123456789012',
  recipientName: 'Learner',
  roleTitle: 'Developer',
  completedHours: 10,
  issuedAt: '2026-10-27T00:00:00.000Z',
  verificationCode: 'a'.repeat(64),
  verificationUrl: 'https://example.test/verify/' + 'a'.repeat(64),
  status: 'VALID',
};
const envelope = (data: unknown) => ({ data: { success: true, error: null, data } });
describe('certificate response validation', () => {
  it('fails closed for null, malformed or unsuccessful responses', async () => {
    const get = vi.spyOn(api, 'get');
    get.mockResolvedValueOnce(envelope(null));
    await expect(getCertificates()).rejects.toThrow();
    get.mockResolvedValueOnce(envelope({ ...certificate, verificationUrl: 'javascript:alert(1)' }));
    await expect(verifyCertificate('a'.repeat(64))).rejects.toThrow();
    get.mockResolvedValueOnce({ data: { success: false, error: null, data: certificate } });
    await expect(verifyCertificate('a'.repeat(64))).rejects.toThrow();
  });
  it('validates valid public metadata and acknowledges name publication on issuance', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(envelope(certificate));
    expect(await verifyCertificate('a'.repeat(64))).toEqual(certificate);
    const post = vi.spyOn(api, 'post').mockResolvedValue(envelope(certificate));
    expect(await issueCertificate(certificate.id)).toEqual(certificate);
    expect(post).toHaveBeenCalledWith('/certificates/issue', {
      roadmapId: certificate.id,
      publishAcknowledged: true,
    });
  });
});
