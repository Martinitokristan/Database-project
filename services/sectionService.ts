import { fetchApi } from '@/lib/fetchApi';

export const sectionService = {
  list:          (params?: { semester_id?: number; course_id?: number; dept_id?: number; year_level_id?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.semester_id) searchParams.append('semester_id', String(params.semester_id));
    if (params?.course_id) searchParams.append('course_id', String(params.course_id));
    if (params?.dept_id) searchParams.append('dept_id', String(params.dept_id));
    if (params?.year_level_id) searchParams.append('year_level_id', String(params.year_level_id));
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return fetchApi(`/api/sections${qs}`);
  },
  get:           (id: number) => fetchApi(`/api/sections/${id}`),
  create:        (data: any)  => fetchApi('/api/sections', { method: 'POST', body: JSON.stringify(data) }),
  update:        (id: number, data: any) => fetchApi(`/api/sections/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove:        (id: number) => fetchApi(`/api/sections/${id}`, { method: 'DELETE' }),
  getSchedules:  (id: number) => fetchApi(`/api/sections/${id}/schedules`),
  getEnrollments:(id: number) => fetchApi(`/api/sections/${id}/enrollments`),
  addStudent:    (id: number, data: { user_id: string }) =>
    fetchApi(`/api/sections/${id}/add-student`, { method: 'POST', body: JSON.stringify(data) }),
  removeStudent: (id: number, userId: string) =>
    fetchApi(`/api/sections/${id}/remove-student/${userId}`, { method: 'DELETE' }),
};
