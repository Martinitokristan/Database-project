import { fetchApi } from '@/lib/fetchApi';

export const gradeService = {
  getByOfferingId:    (offeringId: number) => fetchApi(`/api/grades/${offeringId}`),
  getBySectionId:     (sectionId: number) => fetchApi(`/api/grades/${sectionId}`), // Alias for backward compatibility or direct section-based query
  updateGrade:        (offeringId: number, enrollmentId: number, data: any) =>
    fetchApi(`/api/grades`, { method: 'POST', body: JSON.stringify({ offering_id: offeringId, enrollment_id: enrollmentId, ...data }) }),
  finalize: (offeringId: number) =>
    fetchApi(`/api/subject-offerings/${offeringId}/finalize-grades`, { method: 'POST' }),
};
