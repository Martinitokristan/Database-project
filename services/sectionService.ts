import { fetchApi } from '@/lib/fetchApi';

export const sectionService = {
  list:          (params?: { semester_id?: number }) => {
    const qs = params?.semester_id ? `?semester_id=${params.semester_id}` : '';
    return fetchApi(`/api/sections${qs}`);
  },
  get:           (id: number) => fetchApi(`/api/sections/${id}`),
  create:        (data: any)  => fetchApi('/api/sections', { method: 'POST', body: JSON.stringify(data) }),
  update:        (id: number, data: any) => fetchApi(`/api/sections/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove:        (id: number) => fetchApi(`/api/sections/${id}`, { method: 'DELETE' }),
  getSchedules:  (id: number) => fetchApi(`/api/sections/${id}/schedules`),
  addStudent:    (id: number, data: { user_id: string }) =>
    fetchApi(`/api/sections/${id}/add-student`, { method: 'POST', body: JSON.stringify(data) }),
  removeStudent: (id: number, userId: string) =>
    fetchApi(`/api/sections/${id}/remove-student/${userId}`, { method: 'DELETE' }),
};
