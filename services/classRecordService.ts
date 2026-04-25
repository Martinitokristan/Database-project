import { fetchApi } from '@/lib/fetchApi';

export const classRecordService = {
  listItems:   (offeringId: number) => fetchApi(`/api/class-records?offering_id=${offeringId}`),
  getMatrix:   (offeringId: number) => fetchApi(`/api/class-records/matrix?offering_id=${offeringId}`),
  saveMatrix:  (data: any) => fetchApi('/api/class-records/matrix', { method: 'POST', body: JSON.stringify(data) }),
  getItem:     (itemId: number) => fetchApi(`/api/class-records/${itemId}`),
  createItem:  (data: any) => fetchApi('/api/class-records', { method: 'POST', body: JSON.stringify(data) }),
  updateItem:  (itemId: number, data: any) => fetchApi(`/api/class-records/${itemId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteItem:  (itemId: number) => fetchApi(`/api/class-records/${itemId}`, { method: 'DELETE' }),
  saveScores:  (itemId: number, scores: { enrollment_id: number; score: number | null }[]) =>
    fetchApi(`/api/class-records/${itemId}`, { method: 'PUT', body: JSON.stringify({ scores }) }),
  // Student
  myRecords:   (offeringId?: number) => {
    const qs = offeringId ? `?offering_id=${offeringId}` : '';
    return fetchApi(`/api/student/class-records${qs}`);
  },
};
