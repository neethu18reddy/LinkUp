import { api, type ApiResponse } from '@/lib/api';
import axios from 'axios';
export interface Certificate {
  id: string;
  recipientName: string;
  roleTitle: string;
  completedHours: number;
  issuedAt: string;
  verificationCode: string;
  verificationUrl: string;
  status: 'VALID' | 'INACTIVE';
}
export interface CertificateList {
  certificates: Certificate[];
  roadmaps: {
    id: string;
    title: string;
    eligible: boolean;
    remainingTopics: number;
    missingProjects: number;
    certificateId: string | null;
  }[];
}
export async function getCertificates() {
  return (await api.get<ApiResponse<CertificateList>>('/certificates')).data.data!;
}
export async function issueCertificate(roadmapId: string) {
  return (
    await api.post<ApiResponse<Certificate>>('/certificates/issue', {
      roadmapId,
      publishAcknowledged: true,
    })
  ).data.data!;
}
export async function verifyCertificate(code: string) {
  return (await api.get<ApiResponse<Certificate>>(`/public/verify/${encodeURIComponent(code)}`))
    .data.data!;
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
