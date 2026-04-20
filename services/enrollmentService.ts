import { fetchApi } from '@/lib/fetchApi';

export const enrollmentService = {
  verify: (data: { applicant_id: number; section_id: number }) =>
    fetchApi('/api/enrollments/verify', { method: 'POST', body: JSON.stringify(data) }),
  dropEnrollment: (id: number) =>
    fetchApi(`/api/enrollments/${id}/drop`, { method: 'POST' }),
};
