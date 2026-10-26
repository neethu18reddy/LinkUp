import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { success } from '../../utils/response.js';
import { AppError } from '../../utils/AppError.js';
import type { AuthService } from '../auth/auth.service.js';
import type { CertificateRepository } from './certificates.repository.js';
import { certificatePdf } from './certificates.pdf.js';

export function certificateRoutes(repository: CertificateRepository, auth: AuthService) {
  const router = Router();
  const baseUrl = env.PUBLIC_WEB_URL ?? env.CLIENT_URL[0]!;
  router.use(['/certificates', '/public/verify'], (_req, res, next) => {
    res.set({
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer',
    });
    next();
  });
  router.get(
    '/public/verify/:code',
    validate(z.strictObject({ code: z.string().regex(/^[a-f0-9]{64}$/) }), 'params'),
    asyncHandler(async (req, res) => {
      res.json(success(await repository.find(String(req.params.code), baseUrl)));
    }),
  );
  router.use('/certificates', requireAuth(auth));
  router.get(
    '/certificates',
    asyncHandler(async (req, res) => {
      res.json(success(await repository.list(req.auth!.user.id, baseUrl)));
    }),
  );
  router.post(
    '/certificates/issue',
    validate(z.strictObject({ roadmapId: z.uuid(), publishAcknowledged: z.literal(true) })),
    asyncHandler(async (req, res) => {
      res.json(success(await repository.issue(req.auth!.user.id, req.body.roadmapId, baseUrl)));
    }),
  );
  router.get(
    '/certificates/:id/pdf',
    validate(z.strictObject({ id: z.uuid() }), 'params'),
    asyncHandler(async (req, res) => {
      const certificate = await repository.find(String(req.params.id), baseUrl, req.auth!.user.id);
      if (certificate.status !== 'VALID')
        throw new AppError(
          409,
          'CERTIFICATE_INACTIVE',
          'Complete reopened coursework before downloading.',
        );
      res
        .type('pdf')
        .attachment(`linkup-certificate-${certificate.id}.pdf`)
        .send(await certificatePdf(certificate));
    }),
  );
  return router;
}
