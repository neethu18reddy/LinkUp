import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { requestError } from '@/lib/http';
import { accountStatus, requestVerification } from './account.api';
export function AccountAccessCard() {
  const client = useQueryClient();
  const status = useQuery({ queryKey: ['account-status'], queryFn: accountStatus, retry: false });
  const send = useMutation({
    mutationFn: requestVerification,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['account-status'] });
    },
  });
  return (
    <section className="skills-card">
      <h2>Account access</h2>
      {status.isPending ? (
        <p role="status">Checking your email verification…</p>
      ) : status.isError ? (
        <>
          <p role="alert">{requestError(status.error)}</p>
          <Button variant="outline" onClick={() => void status.refetch()}>
            Retry account status
          </Button>
        </>
      ) : (
        <>
          <p>
            {status.data.emailVerified
              ? 'Your email is verified.'
              : 'Verify your email to protect your account and receive email reminders.'}
            {status.data.googleLinked ? ' Google sign-in is linked.' : ''}
          </p>
          {!status.data.emailVerified &&
            (status.data.emailEnabled ? (
              <Button
                disabled={send.isPending || send.isSuccess}
                variant="outline"
                onClick={() => send.mutate()}
              >
                {send.isPending ? 'Requesting…' : 'Send verification email'}
              </Button>
            ) : (
              <p className="field-hint">
                Email delivery will be available after the owner configures the email provider. Your
                learning workspace is available now.
              </p>
            ))}
        </>
      )}
      {send.data && <p role="status">{send.data}</p>}
      {send.isError && <p role="alert">{requestError(send.error)}</p>}
    </section>
  );
}
