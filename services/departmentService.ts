import { fetchApi } from '@/lib/fetchApi';

export const departmentService = {
  list:   () => fetchApi('/api/departments'),
  create: (data: any) => fetchApi('/api/departments', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) => fetchApi(`/api/departments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: number) => fetchApi(`/api/departments/${id}`, { method: 'DELETE' }),
};
