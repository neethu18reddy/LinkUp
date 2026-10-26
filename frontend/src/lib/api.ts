import axios from 'axios';

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

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 15_000,
  withCredentials: true,
  headers: { Accept: 'application/json' },
});

export async function getHealth(): Promise<Health> {
  const response = await api.get<ApiResponse<Health>>('/health');
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error?.message || 'The server could not be reached.');
  }
  return response.data.data;
}
