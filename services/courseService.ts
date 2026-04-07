import { fetchApi } from '@/lib/fetchApi';

export const courseService = {
  list:   () => fetchApi('/api/courses'),
  create: (data: any) => fetchApi('/api/courses', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) => fetchApi(`/api/courses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: number) => fetchApi(`/api/courses/${id}`, { method: 'DELETE' }),
};
