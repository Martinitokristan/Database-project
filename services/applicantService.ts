import { fetchApi } from '@/lib/fetchApi';

export const applicantService = {
  list:   (params?: { status?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams(params as any).toString();
    return fetchApi(`/api/applicants${qs ? `?${qs}` : ''}`);
  },
  get:    (id: number) => fetchApi(`/api/applicants/${id}`),
  create: (data: any)  => fetchApi('/api/applicants', { method: 'POST', body: JSON.stringify(data) }),
  reject: (id: number) => fetchApi(`/api/applicants/${id}/reject`, { method: 'PUT' }),
};
