import { fetchApi } from '@/lib/fetchApi';

export const assessmentService = {
  list: (params?: { section_id?: number }) => {
    const qs = params?.section_id ? `?section_id=${params.section_id}` : '';
    return fetchApi(`/api/assessments${qs}`);
  },
  get:    (id: number)        => fetchApi(`/api/assessments/${id}`),
  create: (data: any)         => fetchApi('/api/assessments', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) => fetchApi(`/api/assessments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: number)        => fetchApi(`/api/assessments/${id}`, { method: 'DELETE' }),

  publish:   (id: number)     => fetchApi(`/api/assessments/${id}/publish`, { method: 'POST', body: JSON.stringify({ action: 'publish' }) }),
  unpublish: (id: number)     => fetchApi(`/api/assessments/${id}/publish`, { method: 'POST', body: JSON.stringify({ action: 'unpublish' }) }),
  close:     (id: number)     => fetchApi(`/api/assessments/${id}/publish`, { method: 'POST', body: JSON.stringify({ action: 'close' }) }),

  addQuestion:    (id: number, data: any) => fetchApi(`/api/assessments/${id}/questions`, { method: 'POST', body: JSON.stringify(data) }),
  updateQuestion: (id: number, qid: number, data: any) => fetchApi(`/api/assessments/${id}/questions/${qid}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteQuestion: (id: number, qid: number) => fetchApi(`/api/assessments/${id}/questions/${qid}`, { method: 'DELETE' }),

  getAccess:    (id: number)             => fetchApi(`/api/assessments/${id}/access`),
  updateAccess: (id: number, data: any)  => fetchApi(`/api/assessments/${id}/access`, { method: 'PUT', body: JSON.stringify(data) }),

  startAttempt:  (id: number)            => fetchApi(`/api/assessments/${id}/attempt`, { method: 'POST', body: '{}' }),
  getAttempt:    (id: number)            => fetchApi(`/api/assessments/${id}/attempt`),
  saveResponse:  (id: number, data: any) => fetchApi(`/api/assessments/${id}/save-response`, { method: 'POST', body: JSON.stringify(data) }),
  submit:        (id: number, data: any) => fetchApi(`/api/assessments/${id}/submit`, { method: 'POST', body: JSON.stringify(data) }),
  overrideGrade: (id: number, data: any) => fetchApi(`/api/assessments/${id}/submit`, { method: 'PUT', body: JSON.stringify(data) }),

  getResults: (id: number) => fetchApi(`/api/assessments/${id}/results`),

  uploadQuestions: (id: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return fetchApi('/api/assessments/upload', { method: 'POST', body: form });
  },
};
