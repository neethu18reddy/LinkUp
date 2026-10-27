import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import {
  getCertificates,
  issueCertificate,
  downloadCertificate,
} from '@/features/certificates/certificates.api';
import { requestError } from '@/lib/http';
export function CertificatesPage() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['certificates'], queryFn: getCertificates, retry: false });
  const data = query.isError ? undefined : query.data;
  const [acknowledged, setAcknowledged] = useState(false);
  const [message, setMessage] = useState('');
  const issue = useMutation({
    mutationFn: issueCertificate,
    onSuccess: async () => {
      setMessage('Certificate issued.');
      await client.invalidateQueries({ queryKey: ['certificates'] });
    },
  });
  const download = useMutation({ mutationFn: downloadCertificate });
  return (
    <AccountLayout>
      <main className="skills-page">
        <PageHeader
          eyebrow="Your achievements"
          title="Certificates"
          description="Complete every topic and submit each required project to unlock your certificate."
        />
        <p className="field-hint">
          These certificates record learner-reported completion and planned learning hours. They are
          not accredited qualifications.
        </p>
        {query.isPending && <p role="status">Loading certificates…</p>}
        {query.isError && (
          <p role="alert">
            {requestError(query.error)} <Button onClick={() => void query.refetch()}>Retry</Button>
          </p>
        )}
        {(issue.isError || download.isError) && (
          <p role="alert">{requestError(issue.error ?? download.error)}</p>
        )}
        {message && <p role="status">{message}</p>}
        {data && (
          <>
            {!data.roadmaps.length && (
              <p>
                Create a <Link to="/roadmap">roadmap</Link> to get started.
              </p>
            )}
            <label>
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
              />{' '}
              I understand that issuing a certificate makes my name, role, hours and issue date
              visible to anyone with its verification link.
            </label>
            {data.roadmaps
              .filter((row) => !row.certificateId)
              .map((row) => (
                <section className="skills-card" key={row.id}>
                  <h2>{row.title}</h2>
                  <p>
                    {row.eligible
                      ? 'Ready to issue.'
                      : `${row.remainingTopics} unfinished topics; ${row.missingProjects} missing project submissions.`}
                  </p>
                  <Button
                    disabled={!row.eligible || !acknowledged || issue.isPending || query.isFetching}
                    onClick={() => issue.mutate(row.id)}
                  >
                    Issue certificate
                  </Button>
                </section>
              ))}
            {data.certificates.map((certificate) => (
              <section className="skills-card" key={certificate.id}>
                <h2>{certificate.roleTitle}</h2>
                <p>
                  {certificate.recipientName} · {certificate.completedHours} planned hours ·{' '}
                  {certificate.issuedAt.slice(0, 10)} (UTC)
                </p>
                <p>
                  {query.isFetching
                    ? 'Checking current validity…'
                    : certificate.status === 'VALID'
                      ? 'Valid'
                      : 'Inactive: complete reopened coursework to restore validity.'}
                </p>
                <Button
                  disabled={
                    certificate.status !== 'VALID' || download.isPending || query.isFetching
                  }
                  onClick={() => download.mutate(certificate.id)}
                >
                  Download PDF
                </Button>{' '}
                <Link to={`/verify/${certificate.verificationCode}`}>Verify certificate</Link>
                <p>
                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?${new URLSearchParams({ url: certificate.verificationUrl })}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Share on LinkedIn
                  </a>
                  {' · '}
                  <a
                    href={`https://www.linkedin.com/profile/add?${new URLSearchParams({ startTask: 'CERTIFICATION_NAME', name: certificate.roleTitle, organizationName: 'linkup', issueYear: certificate.issuedAt.slice(0, 4), issueMonth: String(Number(certificate.issuedAt.slice(5, 7))), certUrl: certificate.verificationUrl, certId: certificate.id })}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Add to LinkedIn profile
                  </a>
                </p>
                <label className="form-field">
                  Verification link
                  <input
                    readOnly
                    value={certificate.verificationUrl}
                    onFocus={(event) => event.target.select()}
                  />
                </label>
              </section>
            ))}
          </>
        )}
      </main>
    </AccountLayout>
  );
}
