import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAuthOptions } from './account.api';
import { GoogleSignIn } from './GoogleSignIn';
vi.mock('./account.api', () => ({ getAuthOptions: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
describe('Google sign-in availability', () => {
  it('shows the server redirect only when configured', async () => {
    vi.mocked(getAuthOptions).mockResolvedValue({
      googleEnabled: true,
      emailEnabled: false,
      mentorMode: 'offline',
    });
    render(<GoogleSignIn />);
    expect(await screen.findByRole('link', { name: 'Continue with Google' })).toHaveAttribute(
      'href',
      '/api/v1/auth/google/start',
    );
  });
  it('does not show a broken sign-in action when disabled', async () => {
    vi.mocked(getAuthOptions).mockResolvedValue({
      googleEnabled: false,
      emailEnabled: false,
      mentorMode: 'offline',
    });
    render(<GoogleSignIn />);
    await waitFor(() => expect(getAuthOptions).toHaveBeenCalled());
    expect(screen.queryByRole('link', { name: 'Continue with Google' })).not.toBeInTheDocument();
  });
});
