import { fetchApi } from '@/lib/fetchApi';

export const gradeService = {
  getByOfferingId:    (offeringId: number) => fetchApi(`/api/grades/${offeringId}`),
  getBySectionId:     (sectionId: number) => fetchApi(`/api/grades/${sectionId}`), // Alias for backward compatibility or direct section-based query
  updateGrade:        (gradeId: number, data: any) =>
    fetchApi(`/api/grades/${gradeId}`, { method: 'PUT', body: JSON.stringify(data) }),
  finalize: (offeringId: number) =>
    fetchApi(`/api/subject-offerings/${offeringId}/finalize-grades`, { method: 'POST' }),
};
