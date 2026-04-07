import { fetchApi } from '@/lib/fetchApi';

export const scheduleService = {
  create: (data: any) => fetchApi('/api/schedules', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) => fetchApi(`/api/schedules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: number) => fetchApi(`/api/schedules/${id}`, { method: 'DELETE' }),
};
