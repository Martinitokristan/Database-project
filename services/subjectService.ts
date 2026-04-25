import { fetchApi } from '@/lib/fetchApi';

export const subjectService = {
  list:   () => fetchApi('/api/subjects'),
  create: (data: any) => fetchApi('/api/subjects', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) => fetchApi(`/api/subjects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: number) => fetchApi(`/api/subjects/${id}`, { method: 'DELETE' }),
};
