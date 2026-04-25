import { fetchApi } from '@/lib/fetchApi';

export const profileService = {
  get:    (id: string) => fetchApi(`/api/profile/${id}`),
  update: (id: string, data: any) =>
    fetchApi(`/api/profile/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};
