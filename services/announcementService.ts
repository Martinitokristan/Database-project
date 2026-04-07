import { fetchApi } from '@/lib/fetchApi';

export const announcementService = {
  list:   () => fetchApi('/api/announcements'),
  create: (data: any) => fetchApi('/api/announcements', { method: 'POST', body: JSON.stringify(data) }),
  remove: (id: number) => fetchApi(`/api/announcements/${id}`, { method: 'DELETE' }),
};
