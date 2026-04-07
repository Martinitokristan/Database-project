import { fetchApi } from '@/lib/fetchApi';

export const gradeService = {
  getBySectionId:    (sectionId: number) => fetchApi(`/api/grades/${sectionId}`),
  updateByEnrollment:(enrollmentId: number, data: any) =>
    fetchApi(`/api/grades/${enrollmentId}`, { method: 'PUT', body: JSON.stringify(data) }),
};
