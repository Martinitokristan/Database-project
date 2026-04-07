import { fetchApi } from '@/lib/fetchApi';

export const userService = {
  list:       (params?: { search?: string; role?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams(params as any).toString();
    return fetchApi(`/api/users${qs ? `?${qs}` : ''}`);
  },
  get:        (id: string) => fetchApi(`/api/users/${id}`),
  deactivate: (id: string) => fetchApi(`/api/users/${id}`, { method: 'DELETE' }),
};
