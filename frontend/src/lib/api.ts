import axios from 'axios';
import { httpOptions } from './http';
import { useAuth } from '@/store/auth';
import { clearLocalSession, refreshSession } from '@/features/auth/auth.client';

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string; details?: unknown } | null;
}

export interface Health {
  name: string;
  status: 'ok';
  timestamp: string;
}

export const api = axios.create(httpOptions);
api.interceptors.request.use((config) => {
  const token = useAuth.getState().accessToken;
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});
api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 401 || !error.config) throw error;
    const config = error.config as typeof error.config & { retried?: boolean };
    if (config.retried) {
      clearLocalSession();
      throw error;
    }
    if (!config.headers.get('Authorization')) throw error;
    config.retried = true;
    const current = useAuth.getState().accessToken;
    const token =
      current && config.headers.get('Authorization') !== `Bearer ${current}`
        ? current
        : await refreshSession();
    if (!token) throw error;
    config.headers.set('Authorization', `Bearer ${token}`);
    return api.request(config);
  },
);

export async function getHealth(): Promise<Health> {
  const response = await api.get<ApiResponse<Health>>('/health');
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error?.message || 'The server could not be reached.');
  }
  return response.data.data;
}
