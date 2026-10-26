import axios from 'axios';

export const httpOptions = {
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 15_000,
  withCredentials: true,
  headers: { Accept: 'application/json', 'X-Linkup-Request': '1' },
};
export const authHttp = axios.create(httpOptions);

export function requestError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message: unknown = error.response?.data?.error?.message;
    if (typeof message === 'string') return message;
    if (!error.response)
      return 'We couldn’t reach the server. Check your connection and try again.';
  }
  return 'Something went wrong. Please try again.';
}
