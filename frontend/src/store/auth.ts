import { create } from 'zustand';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  createdAt: string;
}
interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  status: 'loading' | 'authenticated' | 'anonymous' | 'error';
  error: string | null;
  setSession: (user: AuthUser, accessToken: string) => void;
  clearSession: () => void;
  setError: (error: string) => void;
}

// Tokens deliberately stay in memory; no localStorage/sessionStorage persistence.
export const useAuth = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  status: 'loading',
  error: null,
  setSession: (user, accessToken) =>
    set({ user, accessToken, status: 'authenticated', error: null }),
  clearSession: () => set({ user: null, accessToken: null, status: 'anonymous', error: null }),
  setError: (error) => set({ user: null, accessToken: null, status: 'error', error }),
}));
