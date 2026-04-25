import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';

export const GET = apiHandler(async (req: NextRequest) => {
  requireRole(req, ['admin']);

  const [[studentsRow], [facultyRow], [sectionsRow], [pendingRow], semesters] = await Promise.all([
    query<any[]>('SELECT COUNT(*) AS cnt FROM users WHERE role_id = 3 AND is_active = TRUE'),
    query<any[]>('SELECT COUNT(*) AS cnt FROM users WHERE role_id = 2 AND is_active = TRUE'),
    query<any[]>('SELECT COUNT(*) AS cnt FROM sections'),
    query<any[]>("SELECT COUNT(*) AS cnt FROM applications WHERE applicant_status = 'Pending'"),
    query<any[]>('SELECT semester_id, term, school_year, start_date, end_date, status FROM semesters ORDER BY start_date DESC'),
  ]);

  const activeSemester = semesters.find((s: any) => s.status === 'Active') ?? null;

  return json({
    success: true,
    data: {
      students: studentsRow.cnt,
      faculty:  facultyRow.cnt,
      sections: sectionsRow.cnt,
      pending:  pendingRow.cnt,
      semester: activeSemester,
    },
  });
});
