import { fetchApi } from '@/lib/fetchApi';

export const subjectOfferingService = {
  list:   (params?: { section_id?: number; subject_id?: number; instructor_id?: string; semester_id?: number }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchApi(`/api/subject-offerings${query ? '?' + query : ''}`);
  },
  get:    (id: number) => fetchApi(`/api/subject-offerings/${id}`),
  create: (data: any)  => fetchApi('/api/subject-offerings', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) => fetchApi(`/api/subject-offerings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: number) => fetchApi(`/api/subject-offerings/${id}`, { method: 'DELETE' }),
};
