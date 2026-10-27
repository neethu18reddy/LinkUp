import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { verifyCertificate } from '@/features/certificates/certificates.api';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { requestError } from '@/lib/http';
export function VerifyPage() {
  const { code = '' } = useParams();
  const query = useQuery({
    queryKey: ['certificate-verification', code],
    queryFn: () => verifyCertificate(code),
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const certificate = query.isError ? undefined : query.data;
  const notFound =
    axios.isAxiosError(query.error) && [404, 422].includes(query.error.response?.status ?? 0);
  return (
    <main className="skills-page">
      <Link to="/">linkup</Link>
      <h1>Certificate verification</h1>
      {query.isPending && <p role="status">Checking certificate…</p>}
      {query.isError && (
        <section className="skills-card" role="alert">
          <h2>{notFound ? 'Certificate not found' : 'Verification is unavailable'}</h2>
          <p>
            {notFound
              ? 'Check that you copied the complete verification link.'
              : requestError(query.error)}
          </p>
          {!notFound && (
            <Button onClick={() => void query.refetch()} disabled={query.isFetching}>
              {query.isFetching ? 'Checking…' : 'Retry verification'}
            </Button>
          )}
        </section>
      )}
      {certificate && (
        <section className="skills-card">
          <h2>
            {query.isFetching
              ? 'Checking current validity…'
              : certificate.status === 'VALID'
                ? 'Verified completion'
                : 'Certificate inactive'}
          </h2>
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
