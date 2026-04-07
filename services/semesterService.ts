import { fetchApi } from '@/lib/fetchApi';

export const semesterService = {
  list:   () => fetchApi('/api/semesters'),
  create: (data: any) => fetchApi('/api/semesters', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) => fetchApi(`/api/semesters/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: number) => fetchApi(`/api/semesters/${id}`, { method: 'DELETE' }),
};
