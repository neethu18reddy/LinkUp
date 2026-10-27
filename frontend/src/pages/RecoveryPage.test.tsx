import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { recoverAccount } from '@/features/auth/account.api';
import { clearLocalSession } from '@/features/auth/auth.client';
import { RecoveryPage } from './RecoveryPage';
vi.mock('@/features/auth/account.api', () => ({ recoverAccount: vi.fn() }));
vi.mock('@/features/auth/auth.client', () => ({ clearLocalSession: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(recoverAccount).mockResolvedValue('Request completed.');
});
function mount(mode: 'forgot' | 'reset' | 'verify', token?: string) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[`/${mode}${token ? '#token=' + token : ''}`]}>
        <RecoveryPage mode={mode} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
describe('account recovery screens', () => {
  it('requests a reset without claiming that an email exists', async () => {
    mount('forgot');
    await userEvent.type(screen.getByLabelText('Account email'), 'learner@example.test');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(recoverAccount).toHaveBeenCalledWith('forgot', { email: 'learner@example.test' });
    expect(await screen.findByRole('status')).toHaveTextContent('Request completed.');
  });
  it('rejects incomplete verification links without a request', () => {
    mount('verify');
    expect(screen.getByRole('alert')).toHaveTextContent('incomplete');
    expect(recoverAccount).not.toHaveBeenCalled();
  });
  it('requires explicit verification rather than consuming a link on page load', async () => {
    const token = 'a'.repeat(64);
    mount('verify', token);
    expect(recoverAccount).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Verify email' }));
    expect(recoverAccount).toHaveBeenCalledWith('verify', { token });
  });
  it('validates password confirmation and clears local authentication after a reset', async () => {
    const token = 'b'.repeat(64);
    mount('reset', token);
    await userEvent.type(screen.getByLabelText('New password'), 'NewLearning!42');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'Different!42');
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('same password');
    expect(recoverAccount).not.toHaveBeenCalled();
    await userEvent.clear(screen.getByLabelText('Confirm new password'));
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'NewLearning!42');
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Request completed.');
    expect(clearLocalSession).toHaveBeenCalledTimes(1);
    expect(recoverAccount).toHaveBeenCalledWith('reset', { token, password: 'NewLearning!42' });
  });
});
