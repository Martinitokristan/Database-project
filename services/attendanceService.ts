import { fetchApi } from '@/lib/fetchApi';

export const attendanceService = {
  /**
   * List attendance records for a section on a specific date
   * Returns student roster + marker details
   */
  list: (sectionId: number, month: number, year: number) => 
    fetchApi(`/api/attendance?section_id=${sectionId}&month=${month}&year=${year}`),

  /**
   * Save a single attendance record
   */
  save: (data: { 
    enrollment_id: number; 
    section_id: number; 
    user_id: string; 
    date: string; 
    status: 'Present' | 'Late' | 'Absent' 
  }) => fetchApi('/api/attendance', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  /**
   * Bulk update attendance for an entire section on a specific date
   */
  saveBulk: (data: { 
    section_id: number; 
    date: string; 
    status: 'Present' | 'Late' | 'Absent' | 'Clear';
    bulk: true;
  }) => fetchApi('/api/attendance', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  /**
   * Export attendance for a section and year
   */
  export: (sectionId: number, year: number) => 
    fetchApi(`/api/attendance/export?section_id=${sectionId}&year=${year}`),
};
