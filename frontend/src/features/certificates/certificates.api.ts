import { api } from '@/lib/api';
import axios from 'axios';
import { z } from 'zod';
const certificateSchema = z.object({
  id: z.uuid(),
  recipientName: z.string(),
  roleTitle: z.string(),
  completedHours: z.number().nonnegative(),
  issuedAt: z.iso.datetime(),
  verificationCode: z.string().regex(/^[a-f0-9]{64}$/),
  verificationUrl: z.url().refine((value) => ['http:', 'https:'].includes(new URL(value).protocol)),
  status: z.enum(['VALID', 'INACTIVE']),
});
const listSchema = z.object({
  certificates: z.array(certificateSchema),
  roadmaps: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      eligible: z.boolean(),
      remainingTopics: z.number().int().nonnegative(),
      missingProjects: z.number().int().nonnegative(),
      certificateId: z.uuid().nullable(),
    }),
  ),
});
export type Certificate = z.infer<typeof certificateSchema>;
export type CertificateList = z.infer<typeof listSchema>;
function result<T>(schema: z.ZodType<T>, body: unknown): T {
  return z.object({ success: z.literal(true), error: z.null(), data: schema }).parse(body).data;
}
export async function getCertificates() {
  return result(listSchema, (await api.get('/certificates')).data);
}
export async function issueCertificate(roadmapId: string) {
  return result(
    certificateSchema,
    (
      await api.post('/certificates/issue', {
        roadmapId,
        publishAcknowledged: true,
      })
    ).data,
  );
}
export async function verifyCertificate(code: string) {
  return result(
    certificateSchema,
    (await api.get(`/public/verify/${encodeURIComponent(code)}`)).data,
  );
}
export async function downloadCertificate(id: string) {
  let response;
  try {
    response = await api.get(`/certificates/${id}/pdf`, { responseType: 'blob' });
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
      try {
        error.response.data = JSON.parse(await error.response.data.text());
      } catch {
        /* Keep the safe generic request error for non-JSON failures. */
      }
    }
    throw error;
  }
  if (!String(response.headers['content-type']).includes('application/pdf'))
    throw new Error('The certificate download failed.');
  const url = URL.createObjectURL(response.data as Blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `linkup-certificate-${id}.pdf`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
