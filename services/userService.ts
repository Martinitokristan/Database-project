import { fetchApi } from '@/lib/fetchApi';

export const userService = {
  list: (params?: { search?: string; role?: string; year_level?: string; page?: number; limit?: number }) => {
    const clean: Record<string, string> = {};
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') clean[k] = String(v);
      }
    }
    const qs = new URLSearchParams(clean).toString();
    return fetchApi(`/api/users${qs ? `?${qs}` : ''}`);
  },
  get:          (id: string) => fetchApi(`/api/users/${id}`),
  update:       (id: string, data: any) => fetchApi(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deactivate:   (id: string) => fetchApi(`/api/users/${id}`, { method: 'DELETE' }),
  toggleActive: (id: string) => fetchApi(`/api/users/${id}/toggle-active`, { method: 'POST' }),
};
