import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { describe, it, expect, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { createApp } from '../src/app.js';
import {
  eligibility,
  type CertificateRepository,
  type CertificateView,
} from '../src/modules/certificates/certificates.repository.js';
import { certificatePdf } from '../src/modules/certificates/certificates.pdf.js';
import { MemoryAuthRepository } from './helpers/memory-auth-repository.js';
const certificate: CertificateView = {
  id: randomUUID(),
  recipientName: 'Zoë García',
  roleTitle: 'Frontend Developer',
  completedHours: 12.5,
  issuedAt: '2026-10-27T00:00:00.000Z',
  verificationCode: 'a'.repeat(64),
  verificationUrl: `http://localhost:5173/verify/${'a'.repeat(64)}`,
  status: 'VALID',
};
describe('certificate completion and PDF', () => {
  it('requires nonempty complete topics and owner project evidence', () => {
    const row = { userId: 'owner', phases: [] } as unknown as Parameters<typeof eligibility>[0];
    expect(eligibility(row).eligible).toBe(false);
    row.phases = [
      { topics: [{ status: 'DONE', isProject: true, submissions: [{ userId: 'other' }] }] },
    ] as typeof row.phases;
    expect(eligibility(row)).toEqual({ eligible: false, remainingTopics: 0, missingProjects: 1 });
    row.phases[0]!.topics[0]!.submissions[0]!.userId = 'owner';
    expect(eligibility(row).eligible).toBe(true);
    row.phases[0]!.topics[0]!.status = 'TODO';
    expect(eligibility(row).eligible).toBe(false);
  });
  it('creates a one-page PDF with embedded fonts and fixed issue date', async () => {
    const pdf = await certificatePdf(certificate);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const document = await PDFDocument.load(pdf);
    expect(document.getPageCount()).toBe(1);
    expect(document.getCreationDate()?.toISOString()).toBe(certificate.issuedAt);
    expect(document.getTitle()).toContain('linkup');
  });
  it('reports unsupported glyphs instead of silently corrupting names', async () => {
    await expect(certificatePdf({ ...certificate, recipientName: '😀' })).rejects.toMatchObject({
      code: 'PDF_FONT_UNSUPPORTED',
    });
  });
  it('keeps verification public, validates codes, and protects issuance and PDFs', async () => {
    const repository = {
      find: vi.fn().mockResolvedValue(certificate),
      issue: vi.fn(),
      list: vi.fn(),
    } as CertificateRepository;
    const app = createApp({
      authSecrets: {
        access: 'certificate-access-'.repeat(4),
        refresh: 'certificate-refresh-'.repeat(4),
      },
      certificateRepository: repository,
      authRepository: new MemoryAuthRepository(),
    });
    expect(
      (await request(app).get(`/api/v1/public/verify/${certificate.verificationCode}`)).body.data,
    ).toEqual(certificate);
    expect((await request(app).get('/api/v1/public/verify/invalid')).status).toBe(422);
    expect(
      (await request(app).post('/api/v1/certificates/issue').send({ roadmapId: randomUUID() }))
        .status,
    ).toBe(401);
    expect((await request(app).get(`/api/v1/certificates/${certificate.id}/pdf`)).status).toBe(401);
    const registration = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Linkup-Request', '1')
      .send({
        name: 'Test learner',
        email: 'certificate@example.test',
        password: 'LearningTogether!42',
      });
    const token = registration.body.data.accessToken as string;
    expect(
      (
        await request(app)
          .post('/api/v1/certificates/issue')
          .auth(token, { type: 'bearer' })
          .send({ roadmapId: randomUUID() })
      ).status,
    ).toBe(422);
    expect(repository.issue).not.toHaveBeenCalled();
  });
});
