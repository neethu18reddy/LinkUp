import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { verifyCertificate } from '@/features/certificates/certificates.api';
export function VerifyPage() {
  const { code = '' } = useParams();
  const query = useQuery({
    queryKey: ['certificate-verification', code],
    queryFn: () => verifyCertificate(code),
    retry: false,
  });
  const certificate = query.data;
  return (
    <main className="skills-page">
      <Link to="/">linkup</Link>
      <h1>Certificate verification</h1>
      {query.isPending && <p role="status">Checking certificate…</p>}
      {query.isError && (
        <p role="alert">We could not verify this certificate. Check the link or try again later.</p>
      )}
      {certificate && (
        <section className="skills-card">
          <h2>{certificate.status === 'VALID' ? 'Verified completion' : 'Certificate inactive'}</h2>
          <p>{certificate.recipientName}</p>
          <p>{certificate.roleTitle}</p>
          <p>{certificate.completedHours} planned learning hours</p>
          <p>Issued {certificate.issuedAt.slice(0, 10)} (UTC)</p>
          <p>Certificate ID: {certificate.id}</p>
          {certificate.status === 'INACTIVE' && (
            <p>
              Coursework was reopened. Completion requirements must be met again to restore
              validity.
            </p>
          )}
          <p>
            linkup records learner-reported topic completion and project evidence. This is not an
            accredited qualification or an independent assessment of project quality.
          </p>
        </section>
      )}
    </main>
  );
}
